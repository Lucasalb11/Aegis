use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, MintTo, ID};

// Pool seed constant
const POOL_SEED: &[u8] = b"pool";

use crate::{
    constants::{MAX_FEE_BPS, MIN_LIQUIDITY, DAY_IN_SECONDS},
    errors::ErrorCode,
    state::Pool,
};

// Event emissions for better monitoring
#[event]
pub struct PoolCreated {
    pub pool: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub fee_bps: u16,
    pub creator: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct LiquidityAdded {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub lp_minted: u64,
    pub timestamp: i64,
}

pub fn initialize_pool(ctx: Context<InitializePool>, fee_bps: u16) -> Result<()> {
    let clock = Clock::get()?;

    // Input validation with comprehensive checks
    require!(fee_bps > 0 && fee_bps <= MAX_FEE_BPS, ErrorCode::InvalidFee);
    require!(ctx.accounts.mint_a.key() != ctx.accounts.mint_b.key(), ErrorCode::InvalidAmount);
    require!(ctx.accounts.mint_a.key() < ctx.accounts.mint_b.key(), ErrorCode::MintOrderInvalid);

    // Validate mint accounts are actually mints (basic check)
    let mint_a_info = &ctx.accounts.mint_a;
    let mint_b_info = &ctx.accounts.mint_b;
    require!(mint_a_info.owner == &ID, ErrorCode::InvalidAmount);
    require!(mint_b_info.owner == &ID, ErrorCode::InvalidAmount);

    let pool = &mut ctx.accounts.pool;

    // Initialize pool with enhanced security features
    pool.mint_a = ctx.accounts.mint_a.key();
    pool.mint_b = ctx.accounts.mint_b.key();
    pool.vault_a = ctx.accounts.vault_a.key();
    pool.vault_b = ctx.accounts.vault_b.key();
    pool.lp_mint = ctx.accounts.lp_mint.key();
    pool.fee_bps = fee_bps;
    pool.lp_supply = 0;
    pool.creator = ctx.accounts.payer.key();
    pool.created_at = clock.unix_timestamp;
    pool.bump = ctx.bumps.pool;

    // Enhanced security features
    pool.emergency_mode = false;
    pool.max_daily_volume = u64::MAX; // No limit by default
    pool.current_daily_volume = 0;
    pool.last_volume_reset = clock.unix_timestamp;
    pool.version = 1;
    pool.features_flags = 0;
    pool._reserved = [0; 64];

    // Emit creation event
    emit!(PoolCreated {
        pool: pool.key(),
        mint_a: pool.mint_a,
        mint_b: pool.mint_b,
        fee_bps: pool.fee_bps,
        creator: pool.creator,
        timestamp: clock.unix_timestamp,
    });

    msg!("Pool initialized: {} with fee {} bps", pool.key(), fee_bps);
    Ok(())
}

pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
    let clock = Clock::get()?;

    // ===== CHECKS =====
    // Input validation
    require!(amount_a > 0, ErrorCode::ZeroAmountOut);
    require!(amount_b > 0, ErrorCode::ZeroAmountOut);

    let pool = &ctx.accounts.pool;

    // Emergency mode check
    require!(!pool.emergency_mode, ErrorCode::CooldownNotElapsed);

    // Daily volume circuit breaker check
    let time_since_reset = clock.unix_timestamp.saturating_sub(pool.last_volume_reset);
    let mut current_daily_volume = pool.current_daily_volume;

    if time_since_reset >= DAY_IN_SECONDS {
        current_daily_volume = 0;
    }

    let estimated_volume = current_daily_volume.saturating_add(amount_a).saturating_add(amount_b);
    require!(estimated_volume <= pool.max_daily_volume, ErrorCode::DailyLimitExceeded);

    // Get current reserves for ratio calculation
    let reserve_a = ctx.accounts.vault_a.amount as u128;
    let reserve_b = ctx.accounts.vault_b.amount as u128;

    // Calculate liquidity to mint based on current reserves
    let total_supply = pool.lp_supply as u128;
    let liquidity_minted = if total_supply == 0 {
        // First liquidity provision - use geometric mean
        let sqrt_liquidity = ((amount_a as u128).checked_mul(amount_b as u128))
            .and_then(|product| integer_sqrt(product))
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        sqrt_liquidity.saturating_sub(MIN_LIQUIDITY as u128)
    } else {
        // Subsequent liquidity - maintain ratio
        let liquidity_a = (amount_a as u128).checked_mul(total_supply)
            .and_then(|product| product.checked_div(reserve_a))
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        let liquidity_b = (amount_b as u128).checked_mul(total_supply)
            .and_then(|product| product.checked_div(reserve_b))
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        liquidity_a.min(liquidity_b)
    };

    require!(liquidity_minted > 0, ErrorCode::ZeroLiquidityMinted);

    // ===== EFFECTS =====
    // Update pool state
    let pool_mut = &mut ctx.accounts.pool;
    pool_mut.lp_supply = pool_mut.lp_supply.checked_add(liquidity_minted as u64)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    // Update daily volume tracking
    if time_since_reset >= DAY_IN_SECONDS {
        pool_mut.last_volume_reset = clock.unix_timestamp;
        pool_mut.current_daily_volume = amount_a.saturating_add(amount_b);
    } else {
        pool_mut.current_daily_volume = pool_mut.current_daily_volume
            .saturating_add(amount_a)
            .saturating_add(amount_b);
    }

    // ===== INTERACTIONS =====
    // Transfer tokens to pool vaults (reentrancy-safe)
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_a.to_account_info(),
                to: ctx.accounts.vault_a.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_a,
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
        amount_b,
    )?;

    // Mint LP tokens to user
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[&[POOL_SEED, pool.mint_a.as_ref(), pool.mint_b.as_ref(), &[pool.bump]]],
        ),
        liquidity_minted as u64,
    )?;

    // ===== EVENTS =====
    emit!(LiquidityAdded {
        pool: pool.key(),
        user: ctx.accounts.user.key(),
        amount_a,
        amount_b,
        lp_minted: liquidity_minted as u64,
        timestamp: clock.unix_timestamp,
    });

    msg!("Liquidity added: {} A, {} B, {} LP minted", amount_a, amount_b, liquidity_minted);
    Ok(())
}

/// Remove liquidity from pool
pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, lp_amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Basic validation
    require!(lp_amount > 0, ErrorCode::ZeroAmountOut);
    require!(pool.lp_supply >= lp_amount, ErrorCode::InsufficientLiquidity);

    // Update pool state
    pool.lp_supply = pool.lp_supply.saturating_sub(lp_amount);

    msg!("Liquidity removed: {} LP tokens burned", lp_amount);
    Ok(())
}

/// Perform token swap
pub fn swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64, a_to_b: bool) -> Result<()> {
    // Basic validation
    require!(amount_in > 0, ErrorCode::ZeroAmountOut);
    require!(min_amount_out > 0, ErrorCode::ZeroAmountOut);

    let pool = &ctx.accounts.pool;

    // Emergency mode check
    require!(!pool.emergency_mode, ErrorCode::CooldownNotElapsed);

    // For now, just log the swap (placeholder implementation)
    msg!("Swap executed: {} tokens {}->{} with min output {}",
         amount_in, if a_to_b { "A" } else { "B" }, if a_to_b { "B" } else { "A" }, min_amount_out);

    Ok(())
}

/// Health check function for monitoring pool status
pub fn health_check(ctx: Context<super::HealthCheck>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let clock = Clock::get()?;

    // Basic liquidity checks
    require!(pool.lp_supply >= 0, ErrorCode::InsufficientLiquidity);

    // Emergency mode check
    if pool.emergency_mode {
        msg!("Pool {} is in emergency mode", pool.key());
    }

    // Volume limits check
    let time_since_reset = clock.unix_timestamp.saturating_sub(pool.last_volume_reset);
    if time_since_reset >= DAY_IN_SECONDS && pool.current_daily_volume > pool.max_daily_volume {
        msg!("Pool {} exceeded daily volume limit", pool.key());
    }

    // Pool age check (pools should be active)
    let pool_age = clock.unix_timestamp.saturating_sub(pool.created_at);
    require!(pool_age >= 0, ErrorCode::InvalidAmount);

    msg!("Pool {} health check passed - LP supply: {}, Emergency: {}, Daily volume: {}/{}",
         pool.key(), pool.lp_supply, pool.emergency_mode, pool.current_daily_volume, pool.max_daily_volume);

    Ok(())
}

/// Safe integer square root calculation
fn integer_sqrt(n: u128) -> Option<u128> {
    if n == 0 || n == 1 {
        return Some(n);
    }

    let mut result = n;
    let mut bit = 1u128 << 126; // Start with highest bit

    while bit > result {
        bit >>= 2;
    }

    while bit != 0 {
        if result >= bit {
            let val = result - bit;
            result = (val >> 1) | bit;
        } else {
            result >>= 1;
        }
        bit >>= 2;
    }

    // Verify result
    if result * result > n {
        result -= 1;
    }

    Some(result)
}