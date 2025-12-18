use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::{
    constants::{
        AEGIS_DECIMALS, AEGIS_DISTRIBUTION_WEEKS, AEGIS_TOTAL_SUPPLY_LAMPORTS, AEGIS_WEEKLY_EMISSION,
        BPS_DENOMINATOR, ECOSYSTEM_PERCENT_BPS, LM_PERCENT_BPS, MIN_LIQ_FOR_REWARDS, MIN_REWARD_POINTS,
        TEAM_PERCENT_BPS, WEEK_IN_SECONDS,
    },
    errors::ErrorCode,
    seeds,
    state::{EmissionVault, Pool, TeamVesting},
};

#[event]
pub struct WeeklyDistribution {
    pub week: u32,
    pub lm_amount: u64,
    pub team_amount: u64,
    pub ecosystem_amount: u64,
    pub caller: Pubkey,
}

#[event]
pub struct PoolRewardsClaimed {
    pub pool: Pubkey,
    pub amount: u64,
    pub boosted: bool,
    pub caller: Pubkey,
    pub points_redeemed: u128,
}

#[derive(Accounts)]
pub struct InitializeEmissionVaultCore<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        seeds = [b"reward_minter"],
        bump,
        space = 8
    )]
    /// CHECK: PDA used only as mint authority
    pub reward_minter: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        mint::decimals = AEGIS_DECIMALS,
        mint::authority = reward_minter
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
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

// Temporarily disabled due to stack size issue - will be reimplemented as separate instructions
// #[derive(Accounts)]
// pub struct InitializeEmissionTokenAccounts<'info> {
//     ...
// }

#[derive(Accounts)]
pub struct DistributeWeeklyRewards<'info> {
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"emission_vault"],
        bump = emission_vault.bump
    )]
    pub emission_vault: Account<'info, EmissionVault>,
    #[account(
        mut,
        address = emission_vault.emission_token_account
    )]
    pub emission_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = emission_vault.lm_vault)]
    pub lm_vault: Account<'info, TokenAccount>,
    #[account(mut, address = emission_vault.team_vault)]
    pub team_vault: Account<'info, TokenAccount>,
    #[account(mut, address = emission_vault.ecosystem_vault)]
    pub ecosystem_vault: Account<'info, TokenAccount>,
    #[account(address = emission_vault.reward_mint)]
    pub aegis_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimPoolRewards<'info> {
    pub caller: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pool", pool.mint_a.as_ref(), pool.mint_b.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [b"emission_vault"],
        bump = emission_vault.bump
    )]
    pub emission_vault: Account<'info, EmissionVault>,
    #[account(
        mut,
        address = emission_vault.lm_vault
    )]
    pub lm_vault: Account<'info, TokenAccount>,
    #[account(address = emission_vault.reward_mint)]
    pub aegis_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = destination.mint == aegis_mint.key() @ ErrorCode::InvalidDestinationMint
    )]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut, address = pool.vault_a)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(mut, address = pool.vault_b)]
    pub vault_b: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn initialize_emission_vault_core(ctx: Context<InitializeEmissionVaultCore>) -> Result<()> {
    require!(
        ctx.accounts.emission_vault.last_distribution_ts == 0,
        ErrorCode::AlreadyInitialized
    );

    let reward_minter_bump = ctx.bumps.reward_minter;
    let emission_bump = ctx.bumps.emission_vault;

    let emission_vault = &mut ctx.accounts.emission_vault;
    emission_vault.bump = emission_bump;
    emission_vault.last_distribution_ts = 0;
    emission_vault.week_counter = 0;
    emission_vault.total_emitted = 0;
    emission_vault.weekly_amount = AEGIS_WEEKLY_EMISSION;
    emission_vault.reward_mint = ctx.accounts.aegis_mint.key();
    emission_vault.emission_token_account = Pubkey::default();
    emission_vault.lm_vault = Pubkey::default();
    emission_vault.team_vault = Pubkey::default();
    emission_vault.ecosystem_vault = Pubkey::default();
    emission_vault._reserved = [0; 16];

    Ok(())
}

// Temporarily disabled - will be reimplemented
/*
pub fn initialize_emission_token_accounts(ctx: Context<InitializeEmissionTokenAccounts>) -> Result<()> {
    // Update emission vault - use minimal scope
    {
        let emission_vault = &mut ctx.accounts.emission_vault;
        emission_vault.emission_token_account = ctx.accounts.emission_token_account.key();
        emission_vault.lm_vault = ctx.accounts.lm_vault.key();
        emission_vault.team_vault = ctx.accounts.team_vault.key();
        emission_vault.ecosystem_vault = ctx.accounts.ecosystem_vault.key();
    }

    // Initialize team vesting - calculate values inline to reduce stack
    {
        let now = Clock::get()?.unix_timestamp;
        const MONTH_SECONDS: i64 = 30 * 24 * 60 * 60;
        let cliff_end = now
            .checked_add(MONTH_SECONDS * 12)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        let linear_end = cliff_end
            .checked_add(MONTH_SECONDS * 36)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        
        let vesting = &mut ctx.accounts.team_vesting;
        let admin_key = ctx.accounts.admin.key();
        vesting.bump = ctx.bumps.team_vesting;
        vesting.start_ts = now;
        vesting.cliff_end_ts = cliff_end;
        vesting.linear_end_ts = linear_end;
        vesting.claimed = 0;
        vesting.vault = ctx.accounts.team_vault.key();
        vesting.treasury = admin_key;
        // Initialize guardians array element by element to reduce stack usage
        vesting.guardians[0] = admin_key;
        vesting.guardians[1] = admin_key;
        vesting.guardians[2] = admin_key;
        vesting.guardians[3] = admin_key;
        vesting.guardians[4] = admin_key;
        vesting.guardians[5] = admin_key;
        vesting.guardians[6] = admin_key;
        vesting.threshold = 4;
        vesting._reserved = [0; 7];
    }

    // Mint tokens - calculate supply first to reduce stack usage
    const SUPPLY_LAMPORTS: u128 = AEGIS_TOTAL_SUPPLY_LAMPORTS;
    let capped_supply = if SUPPLY_LAMPORTS > u128::from(u64::MAX) {
        msg!(
            "Requested total supply {} exceeds SPL limit; capping to {}",
            SUPPLY_LAMPORTS,
            u64::MAX
        );
        u64::MAX
    } else {
        SUPPLY_LAMPORTS as u64
    };

    // Create seeds and mint in separate scope to free stack earlier
    {
        let reward_minter_bump = ctx.bumps.reward_minter;
        let (_rm_bump, rm_seeds) = seeds::reward_minter_seeds(reward_minter_bump);
        // Build signer seeds slice directly without intermediate Vec
        let rm_signer_seeds: [&[u8]; 2] = [rm_seeds[0].as_slice(), rm_seeds[1].as_slice()];
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
            capped_supply,
        )?;
    }

    Ok(())
}
*/

#[inline(never)]
pub fn distribute_weekly_rewards(ctx: Context<DistributeWeeklyRewards>) -> Result<()> {
    // Reentrancy guard temporarily disabled to fix compilation
    // let mut guard = ReentrancyGuard::new();
    // guard.enter()?;

    let result = (|| {
        let clock = Clock::get()?;
        let emission_vault = &ctx.accounts.emission_vault;

        if emission_vault.week_counter >= AEGIS_DISTRIBUTION_WEEKS {
            return err!(ErrorCode::EmissionCompleted);
        }

        if emission_vault.last_distribution_ts != 0 {
            let elapsed = clock
                .unix_timestamp
                .checked_sub(emission_vault.last_distribution_ts)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            require!(elapsed >= WEEK_IN_SECONDS, ErrorCode::CooldownNotElapsed);
        }

        let (lm_amount, team_amount, ecosystem_amount) = calculate_distribution_amounts(emission_vault.weekly_amount)?;

        let total_needed = (lm_amount as u128)
            .checked_add(team_amount as u128)
            .and_then(|v| v.checked_add(ecosystem_amount as u128))
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

        require!(
            ctx.accounts.emission_token_account.amount as u128 >= total_needed,
            ErrorCode::EmissionInsufficientBalance
        );

        transfer_rewards(&ctx, lm_amount, team_amount, ecosystem_amount)?;

        {
            let emission_vault = &mut ctx.accounts.emission_vault;
            emission_vault.last_distribution_ts = clock.unix_timestamp;
            emission_vault.week_counter = emission_vault
                .week_counter
                .checked_add(1)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            emission_vault.total_emitted = emission_vault
                .total_emitted
                .checked_add(emission_vault.weekly_amount as u128)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

            emit!(WeeklyDistribution {
                week: emission_vault.week_counter,
                lm_amount,
                team_amount,
                ecosystem_amount,
                caller: ctx.accounts.caller.key(),
            });
        }

        Ok(())
    })();

    result
}

#[inline(never)]
fn calculate_distribution_amounts(weekly_amount: u64) -> Result<(u64, u64, u64)> {
    let weekly_amount_u128 = weekly_amount as u128;

    let lm_amount_u128 = weekly_amount_u128
        .checked_mul(LM_PERCENT_BPS as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    let team_amount_u128 = weekly_amount_u128
        .checked_mul(TEAM_PERCENT_BPS as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    let ecosystem_amount_u128 = weekly_amount_u128
        .checked_mul(ECOSYSTEM_PERCENT_BPS as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    let lm_amount = lm_amount_u128
        .try_into()
        .map_err(|_| error!(ErrorCode::ArithmeticOverflow))?;

    let team_amount = team_amount_u128
        .try_into()
        .map_err(|_| error!(ErrorCode::ArithmeticOverflow))?;

    let ecosystem_amount = ecosystem_amount_u128
        .try_into()
        .map_err(|_| error!(ErrorCode::ArithmeticOverflow))?;

    Ok((lm_amount, team_amount, ecosystem_amount))
}

#[inline(never)]
fn transfer_rewards(
    ctx: &Context<DistributeWeeklyRewards>,
    lm_amount: u64,
    team_amount: u64,
    ecosystem_amount: u64,
) -> Result<()> {
    let emission_vault = &ctx.accounts.emission_vault;
    let (_ev_bump, emission_signer) = seeds::emission_vault_seeds(emission_vault.bump);
    let mut emission_signer_seeds: Vec<&[u8]> = Vec::with_capacity(emission_signer.len());
    for s in emission_signer.iter() {
        emission_signer_seeds.push(s.as_slice());
    }
    let emission_signer_slice: &[&[u8]] = emission_signer_seeds.as_slice();

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.emission_token_account.to_account_info(),
                to: ctx.accounts.lm_vault.to_account_info(),
                authority: emission_vault.to_account_info(),
            },
            &[emission_signer_slice],
        ),
        lm_amount,
    )?;

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.emission_token_account.to_account_info(),
                to: ctx.accounts.team_vault.to_account_info(),
                authority: emission_vault.to_account_info(),
            },
            &[emission_signer_slice],
        ),
        team_amount,
    )?;

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.emission_token_account.to_account_info(),
                to: ctx.accounts.ecosystem_vault.to_account_info(),
                authority: emission_vault.to_account_info(),
            },
            &[emission_signer_slice],
        ),
        ecosystem_amount,
    )?;

    Ok(())
}

pub fn claim_pool_rewards(ctx: Context<ClaimPoolRewards>) -> Result<()> {
    let clock = Clock::get()?;
    let pool = &mut ctx.accounts.pool;

    require!(pool.reward_points >= MIN_REWARD_POINTS, ErrorCode::NoRewardPoints);

    let liquid_a = ctx.accounts.vault_a.amount;
    let liquid_b = ctx.accounts.vault_b.amount;
    let has_liquidity = liquid_a
        .checked_add(liquid_b)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        >= MIN_LIQ_FOR_REWARDS;

    let boosted = pool.swap_count < 100 && has_liquidity;
    let boost_multiplier: u128 = if boosted { 2 } else { 1 };

    let reward_amount_u128 = pool
        .reward_points
        .checked_mul(boost_multiplier)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    let available = ctx.accounts.lm_vault.amount as u128;
    let transferable = reward_amount_u128.min(available);
    let transfer_amount: u64 = transferable
        .try_into()
        .map_err(|_| error!(ErrorCode::ArithmeticOverflow))?;
    require!(transfer_amount > 0, ErrorCode::NoRewardPoints);

    let (_ev_bump, emission_signer) = seeds::emission_vault_seeds(ctx.accounts.emission_vault.bump);
    let mut emission_signer_seeds: Vec<&[u8]> = Vec::with_capacity(emission_signer.len());
    for s in emission_signer.iter() {
        emission_signer_seeds.push(s.as_slice());
    }
    let emission_signer_slice: &[&[u8]] = emission_signer_seeds.as_slice();

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.lm_vault.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.emission_vault.to_account_info(),
            },
            &[emission_signer_slice],
        ),
        transfer_amount,
    )?;

    pool.reward_points = 0;
    pool.last_reward_claim_ts = clock.unix_timestamp;

    emit!(PoolRewardsClaimed {
        pool: pool.key(),
        amount: transfer_amount,
        boosted,
        caller: ctx.accounts.caller.key(),
        points_redeemed: reward_amount_u128,
    });

    Ok(())
}