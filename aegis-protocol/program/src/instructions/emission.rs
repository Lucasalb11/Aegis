use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::{
    constants::{
        AEGIS_DECIMALS, AEGIS_INITIAL_MINT, AEGIS_WEEKLY_EMISSION, EMISSION_ADMIN, WEEK_IN_SECONDS,
    },
    errors::ErrorCode,
    seeds,
    state::EmissionVault,
};
use std::str::FromStr;

#[event]
pub struct WeeklyDistribution {
    pub week: u32,
    pub liquidity: u64,
    pub team: u64,
}

#[derive(Accounts)]
pub struct InitializeEmissionVault<'info> {
    #[account(
        mut,
        constraint = admin.key() == EMISSION_ADMIN.parse::<Pubkey>().unwrap() @ ErrorCode::InvalidAmount
    )]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        seeds = [b"reward_minter"],
        bump,
        space = 8
    )]
    /// CHECK: PDA used as mint authority, no data
    pub reward_minter: AccountInfo<'info>,
    #[account(
        init,
        payer = admin,
        mint::decimals = AEGIS_DECIMALS,
        mint::authority = reward_minter,
        mint::freeze_authority = None
    )]
    pub aegis_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        seeds = [b"emission_vault"],
        bump,
        space = EmissionVault::SIZE
    )]
    pub emission_vault: Account<'info, EmissionVault>,
    #[account(
        init,
        payer = admin,
        token::mint = aegis_mint,
        token::authority = emission_vault
    )]
    pub emission_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = admin,
        seeds = [b"lm_vault"],
        bump,
        token::mint = aegis_mint,
        token::authority = emission_vault
    )]
    pub lm_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = admin,
        seeds = [b"team_vault"],
        bump,
        token::mint = aegis_mint,
        token::authority = emission_vault
    )]
    pub team_vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DistributeWeeklyRewards<'info> {
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"reward_minter"],
        bump
    )]
    /// CHECK: PDA signer only
    pub reward_minter: AccountInfo<'info>,
    #[account(mut)]
    pub aegis_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"emission_vault"],
        bump = emission_vault.bump
    )]
    pub emission_vault: Account<'info, EmissionVault>,
    #[account(
        mut,
        constraint = emission_token_account.mint == aegis_mint.key()
    )]
    pub emission_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"lm_vault"],
        bump
    )]
    pub lm_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"team_vault"],
        bump
    )]
    pub team_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_emission_vault(ctx: Context<InitializeEmissionVault>) -> Result<()> {
    // Ensure one-time initialization
    require!(
        ctx.accounts.emission_vault.last_distribution_ts == 0,
        ErrorCode::AlreadyInitialized
    );

    let reward_minter_bump = ctx.bumps.reward_minter;
    let emission_bump = ctx.bumps.emission_vault;

    let emission_vault = &mut ctx.accounts.emission_vault;
    emission_vault.bump = emission_bump;
    emission_vault.last_distribution_ts = 0;
    emission_vault.weekly_amount = AEGIS_WEEKLY_EMISSION;
    emission_vault._reserved = [0; 5];

    let (_rm_bump, rm_seeds) = seeds::reward_minter_seeds(reward_minter_bump);
    let rm_signer_seeds: Vec<&[u8]> = rm_seeds.iter().map(|s| s.as_slice()).collect();
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.aegis_mint.to_account_info(),
                to: ctx.accounts.emission_token_account.to_account_info(),
                authority: ctx.accounts.reward_minter.to_account_info(),
            },
            &[&rm_signer_seeds],
        ),
        AEGIS_INITIAL_MINT,
    )?;

    Ok(())
}

pub fn distribute_weekly_rewards(ctx: Context<DistributeWeeklyRewards>) -> Result<()> {
    let clock = Clock::get()?;
    let now_ts: u64 = clock.unix_timestamp.try_into().map_err(|_| error!(ErrorCode::ArithmeticOverflow))?;

    let emission_vault = &mut ctx.accounts.emission_vault;
    let last = emission_vault.last_distribution_ts;
    if last != 0 {
        let elapsed = now_ts.checked_sub(last).ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        require!((elapsed as i64) >= WEEK_IN_SECONDS, ErrorCode::CooldownNotElapsed);
    }

    let weekly = emission_vault.weekly_amount;
    let liquidity_amount = weekly
        .checked_mul(60)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        .checked_div(100)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let team_amount = weekly
        .checked_mul(40)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        .checked_div(100)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let total = liquidity_amount
        .checked_add(team_amount)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    require!(ctx.accounts.emission_token_account.amount >= total, ErrorCode::InsufficientBalance);

    let emission_bump = emission_vault.bump;
    let (_ev_bump, emission_signer) = seeds::emission_vault_seeds(emission_bump);
    let emission_signer_seeds: Vec<&[u8]> = emission_signer.iter().map(|s| s.as_slice()).collect();

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.emission_token_account.to_account_info(),
                to: ctx.accounts.lm_vault.to_account_info(),
                authority: emission_vault.to_account_info(),
            },
            &[&emission_signer_seeds],
        ),
        liquidity_amount,
    )?;

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.emission_token_account.to_account_info(),
                to: ctx.accounts.team_vault.to_account_info(),
                authority: emission_vault.to_account_info(),
            },
            &[&emission_signer_seeds],
        ),
        team_amount,
    )?;

    emission_vault.last_distribution_ts = now_ts;

    let week_number: u32 = if last == 0 {
        1
    } else {
        last.checked_div(WEEK_IN_SECONDS as u64)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?
            .checked_add(1)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?
            .try_into()
            .map_err(|_| error!(ErrorCode::ArithmeticOverflow))?
    };

    emit!(WeeklyDistribution {
        week: week_number,
        liquidity: liquidity_amount,
        team: team_amount,
    });

    Ok(())
}
