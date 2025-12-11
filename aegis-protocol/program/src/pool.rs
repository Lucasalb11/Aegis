use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token::{self, MintTo, Token, TokenAccount, Transfer};

use crate::{
    constants::{
        BPS_DENOMINATOR, MAX_FEE_BPS, MIN_LIQUIDITY, MIN_REWARD_POINTS, REWARD_POINTS_FEE_BPS,
    },
    errors::ErrorCode,
    math,
    seeds,
    state::Pool,
    validation,
};

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint_a: Account<'info, anchor_spl::token::Mint>,
    pub mint_b: Account<'info, anchor_spl::token::Mint>,
    #[account(
        init,
        payer = payer,
        space = Pool::SIZE,
        seeds = [b"pool", mint_a.key().as_ref(), mint_b.key().as_ref()],
        bump,
        constraint = mint_a.key() < mint_b.key() @ ErrorCode::MintOrderInvalid
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = payer,
        token::mint = mint_a,
        token::authority = pool,
        seeds = [b"pool_vault", pool.key().as_ref(), mint_a.key().as_ref()],
        bump
    )]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        token::mint = mint_b,
        token::authority = pool,
        seeds = [b"pool_vault", pool.key().as_ref(), mint_b.key().as_ref()],
        bump
    )]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        mint::decimals = mint_a.decimals,
        mint::authority = pool,
        seeds = [b"lp_mint", pool.key().as_ref()],
        bump
    )]
    pub lp_mint: Account<'info, anchor_spl::token::Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pool", pool.mint_a.as_ref(), pool.mint_b.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        address = pool.vault_a,
        constraint = vault_a.mint == pool.mint_a @ ErrorCode::InvalidVault
    )]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = pool.vault_b,
        constraint = vault_b.mint == pool.mint_b @ ErrorCode::InvalidVault
    )]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = pool.lp_mint,
        constraint = lp_mint.mint_authority == COption::Some(pool.key()) @ ErrorCode::InvalidLpMint
    )]
    pub lp_mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, lp_amount: u64) -> Result<()> {
    require!(lp_amount > 0, ErrorCode::ZeroAmountOut);
    require!(ctx.accounts.pool.lp_supply >= lp_amount, ErrorCode::InsufficientLiquidity);
    Ok(())
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"pool", pool.mint_a.as_ref(), pool.mint_b.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        address = pool.vault_a,
        constraint = vault_a.mint == pool.mint_a @ ErrorCode::InvalidVault
    )]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = pool.vault_b,
        constraint = vault_b.mint == pool.mint_b @ ErrorCode::InvalidVault
    )]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_source: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pool", pool.mint_a.as_ref(), pool.mint_b.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut, address = pool.vault_a)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(mut, address = pool.vault_b)]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(mut, address = pool.lp_mint)]
    pub lp_mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct HealthCheck<'info> {
    #[account(
        seeds = [b"pool", pool.mint_a.as_ref(), pool.mint_b.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
}

pub fn initialize_pool(ctx: Context<InitializePool>, fee_bps: u16) -> Result<()> {
    validation::assert_positive(fee_bps.into())?;
    require!(fee_bps <= MAX_FEE_BPS, ErrorCode::InvalidFee);
    assert_mint_order(&ctx.accounts.mint_a.key(), &ctx.accounts.mint_b.key())?;

    let pool = &mut ctx.accounts.pool;
    pool.mint_a = ctx.accounts.mint_a.key();
    pool.mint_b = ctx.accounts.mint_b.key();
    pool.vault_a = ctx.accounts.vault_a.key();
    pool.vault_b = ctx.accounts.vault_b.key();
    pool.lp_mint = ctx.accounts.lp_mint.key();
    pool.fee_bps = fee_bps;
    pool.lp_supply = 0;
    pool.creator = ctx.accounts.payer.key();
    pool.bump = ctx.bumps.pool;
    pool.vault_a_bump = ctx.bumps.vault_a;
    pool.vault_b_bump = ctx.bumps.vault_b;
    pool.lp_mint_bump = ctx.bumps.lp_mint;
    pool.reward_points = 0;
    pool.swap_count = 0;
    pool.last_reward_claim_ts = 0;
    pool._reserved = [0; 32];
    Ok(())
}

pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
    validation::assert_positive(amount_a)?;
    validation::assert_positive(amount_b)?;

    let pool = &ctx.accounts.pool;
    require!(
        ctx.accounts.lp_mint.mint_authority == COption::Some(pool.key()),
        ErrorCode::InvalidLpMint
    );

    let reserve_a = ctx.accounts.vault_a.amount as u128;
    let reserve_b = ctx.accounts.vault_b.amount as u128;

    let (used_a, used_b, minted) = compute_liquidity_mint(amount_a, amount_b, reserve_a, reserve_b, pool.lp_supply)?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_a.to_account_info(),
                to: ctx.accounts.vault_a.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        used_a,
    )?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_b.to_account_info(),
                to: ctx.accounts.vault_b.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        used_b,
    )?;

    let (_bump_bytes, signer_seeds) = seeds::pool_signer_seeds(pool);
    let signer_seeds_slice: Vec<&[u8]> = signer_seeds.iter().map(|s| s.as_slice()).collect();
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[&signer_seeds_slice],
        ),
        minted,
    )?;

    let pool = &mut ctx.accounts.pool;
    pool.lp_supply = math::add_u64(pool.lp_supply, minted)?;
    Ok(())
}

pub fn swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64, a_to_b: bool) -> Result<()> {
    validation::assert_positive(amount_in)?;
    validation::assert_positive(min_amount_out)?;

    let result = (|| {
        let pool = &ctx.accounts.pool;
        let (input_vault, output_vault) = if a_to_b {
            (&ctx.accounts.vault_a, &ctx.accounts.vault_b)
        } else {
            (&ctx.accounts.vault_b, &ctx.accounts.vault_a)
        };

        let amount_out = compute_swap_out(
            amount_in,
            input_vault.amount as u128,
            output_vault.amount as u128,
            pool.fee_bps,
        )?;
        require!(amount_out >= min_amount_out, ErrorCode::SlippageExceeded);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_source.to_account_info(),
                    to: input_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;

        let (_bump_bytes, signer_seeds) = seeds::pool_signer_seeds(pool);
        let signer_seeds_slice: Vec<&[u8]> = signer_seeds.iter().map(|s| s.as_slice()).collect();
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: output_vault.to_account_info(),
                    to: ctx.accounts.user_destination.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[&signer_seeds_slice],
            ),
            amount_out,
        )?;

        Ok(())
    })();

    // Update pool state only if swap succeeded
    if result.is_ok() {
        let pool = &mut ctx.accounts.pool;
        let fee_points = (amount_in as u128)
            .checked_mul(REWARD_POINTS_FEE_BPS as u128)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        let effective_points = fee_points.max(MIN_REWARD_POINTS);
        pool.reward_points = pool
            .reward_points
            .checked_add(effective_points)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        pool.swap_count = pool
            .swap_count
            .checked_add(1)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    }

    result
}

pub fn health_check(_ctx: Context<HealthCheck>) -> Result<()> {
    Ok(())
}

fn compute_liquidity_mint(
    amount_a: u64,
    amount_b: u64,
    reserve_a: u128,
    reserve_b: u128,
    lp_supply: u64,
) -> Result<(u64, u64, u64)> {
    let mut used_a = amount_a as u128;
    let mut used_b = amount_b as u128;
    let minted: u128;

    if lp_supply == 0 {
        let product = used_a
            .checked_mul(used_b)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        let liquidity = math::integer_sqrt(product);
        require!(liquidity >= MIN_LIQUIDITY as u128, ErrorCode::InsufficientLiquidity);
        minted = liquidity;
    } else {
        let lp_supply = lp_supply as u128;
        let optimal_b = used_a
            .checked_mul(reserve_b)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?
            .checked_div(reserve_a)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

        if optimal_b <= used_b {
            used_b = optimal_b;
            minted = used_a
                .checked_mul(lp_supply)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?
                .checked_div(reserve_a)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        } else {
            used_a = used_b
                .checked_mul(reserve_a)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?
                .checked_div(reserve_b)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
            minted = used_b
                .checked_mul(lp_supply)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?
                .checked_div(reserve_b)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
        }
        require!(minted > 0, ErrorCode::ZeroLiquidityMinted);
    }

    Ok((
        used_a.try_into().map_err(|_| error!(ErrorCode::ArithmeticOverflow))?,
        used_b.try_into().map_err(|_| error!(ErrorCode::ArithmeticOverflow))?,
        minted.try_into().map_err(|_| error!(ErrorCode::ArithmeticOverflow))?,
    ))
}

fn compute_swap_out(amount_in: u64, reserve_in: u128, reserve_out: u128, fee_bps: u16) -> Result<u64> {
    require!(reserve_in > 0 && reserve_out > 0, ErrorCode::InsufficientLiquidity);

    let amount_in_after_fee = (amount_in as u128)
        .checked_mul((BPS_DENOMINATOR - fee_bps as u64) as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    let new_reserve_in = reserve_in
        .checked_add(amount_in_after_fee)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let k = reserve_in
        .checked_mul(reserve_out)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let new_reserve_out = k
        .checked_div(new_reserve_in)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let amount_out = reserve_out
        .checked_sub(new_reserve_out)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    let out_u64: u64 = amount_out.try_into().map_err(|_| error!(ErrorCode::ArithmeticOverflow))?;
    require!(out_u64 > 0, ErrorCode::ZeroAmountOut);
    Ok(out_u64)
}

fn assert_mint_order(mint_a: &Pubkey, mint_b: &Pubkey) -> Result<()> {
    require!(mint_a < mint_b, ErrorCode::MintOrderInvalid);
    Ok(())
}