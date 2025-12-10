use anchor_lang::prelude::*;
use pyth_sdk_solana::load_price_feed_from_account_info;
use std::str::FromStr;

use crate::{
    constants::{DEFAULT_MAX_STALENESS_SECONDS, ORACLE_SLIPPAGE_BPS, PYTH_PROGRAM_ID},
    errors::ErrorCode,
    math,
    seeds,
    state::{OracleConfig, OracleType, Pool},
    validation,
};

#[derive(Accounts)]
pub struct ConfigureOracle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [b"pool", pool.mint_a.as_ref(), pool.mint_b.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = payer,
        space = OracleConfig::SIZE,
        seeds = [b"oracle", pool.key().as_ref()],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOracleManual<'info> {
    #[account(mut, has_one = authority, has_one = pool)]
    pub oracle_config: Account<'info, OracleConfig>,
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"pool", pool.mint_a.as_ref(), pool.mint_b.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn configure_oracle(
    ctx: Context<ConfigureOracle>,
    oracle_type: OracleType,
    feed_a: Pubkey,
    feed_b: Pubkey,
    max_staleness_seconds: i64,
) -> Result<()> {
    let oracle = &mut ctx.accounts.oracle_config;
    let pool = &ctx.accounts.pool;

    let staleness = if max_staleness_seconds == 0 {
        DEFAULT_MAX_STALENESS_SECONDS
    } else {
        max_staleness_seconds
    };
    validation::assert_staleness(staleness, 0, 0)?;

    oracle.pool = pool.key();
    oracle.feed_a = feed_a;
    oracle.feed_b = feed_b;
    oracle.price_a = 0;
    oracle.price_b = 0;
    oracle.expo_a = 0;
    oracle.expo_b = 0;
    oracle.max_staleness_seconds = staleness;
    oracle.last_updated_ts = 0;
    oracle.authority = ctx.accounts.payer.key();
    oracle.oracle_type = oracle_type;
    oracle.bump = ctx.bumps.oracle_config;
    oracle._reserved = [0; 7];
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateOracleFromPyth<'info> {
    #[account(mut, has_one = pool)]
    pub oracle_config: Account<'info, OracleConfig>,
    #[account(
        seeds = [b"pool", pool.mint_a.as_ref(), pool.mint_b.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
    /// CHECK: validated against oracle_config.feed_a and owner check
    #[account(address = oracle_config.feed_a)]
    pub feed_a: UncheckedAccount<'info>,
    /// CHECK: validated against oracle_config.feed_b and owner check
    #[account(address = oracle_config.feed_b)]
    pub feed_b: UncheckedAccount<'info>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn update_oracle_manual(
    ctx: Context<UpdateOracleManual>,
    price_a: i64,
    expo_a: i32,
    price_b: i64,
    expo_b: i32,
) -> Result<()> {
    require!(ctx.accounts.oracle_config.oracle_type == OracleType::Manual, ErrorCode::OracleNotConfigured);
    require!(price_a > 0 && price_b > 0, ErrorCode::OraclePriceInvalid);

    let clock = Clock::get()?;
    let oracle = &mut ctx.accounts.oracle_config;
    oracle.price_a = price_a;
    oracle.expo_a = expo_a;
    oracle.price_b = price_b;
    oracle.expo_b = expo_b;
    oracle.last_updated_ts = clock.unix_timestamp;
    Ok(())
}

pub fn update_oracle_from_pyth(ctx: Context<UpdateOracleFromPyth>) -> Result<()> {
    require!(ctx.accounts.oracle_config.oracle_type == OracleType::Pyth, ErrorCode::OracleNotConfigured);
    let clock = Clock::get()?;

    let price_a = read_pyth(&ctx.accounts.feed_a)?;
    let price_b = read_pyth(&ctx.accounts.feed_b)?;

    validation::assert_staleness(
        ctx.accounts.oracle_config.max_staleness_seconds,
        clock.unix_timestamp,
        price_a.2.min(price_b.2),
    )?;

    let oracle = &mut ctx.accounts.oracle_config;
    oracle.price_a = price_a.0;
    oracle.price_b = price_b.0;
    oracle.expo_a = price_a.1;
    oracle.expo_b = price_b.1;
    oracle.last_updated_ts = clock.unix_timestamp;
    Ok(())
}

fn read_pyth(feed: &AccountInfo) -> Result<(i64, i32, i64)> {
    // Validate that the feed account is owned by Pyth program
    let pyth_program_id = Pubkey::from_str(PYTH_PROGRAM_ID).map_err(|_| error!(ErrorCode::OraclePriceInvalid))?;
    require_keys_eq!(*feed.owner, pyth_program_id, ErrorCode::OraclePriceInvalid);

    let price_feed = load_price_feed_from_account_info(feed).map_err(|_| error!(ErrorCode::OraclePriceInvalid))?;
    let price = price_feed
        .get_price_no_older_than(Clock::get()?.unix_timestamp, 60)
        .ok_or(error!(ErrorCode::OraclePriceInvalid))?;

    Ok((price.price, price.expo, price.publish_time))
}

pub fn compute_expected_out_from_oracle(
    oracle: &OracleConfig,
    amount_in: u64,
    decimals_in: u8,
    decimals_out: u8,
) -> Result<u64> {
    require!(oracle.price_a > 0 && oracle.price_b > 0, ErrorCode::OraclePriceInvalid);

    let price_in = oracle.price_a as i128;
    let price_out = oracle.price_b as i128;
    let expo_diff = (oracle.expo_a as i32 - oracle.expo_b as i32)
        .checked_add(decimals_out as i32)
        .and_then(|v| v.checked_sub(decimals_in as i32))
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    let mut numerator: i128 = amount_in as i128;
    numerator = numerator
        .checked_mul(price_in)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let mut denominator: i128 = price_out;

    if expo_diff >= 0 {
        let scale = math::pow10(expo_diff as u32)? as i128;
        numerator = numerator
            .checked_mul(scale)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    } else {
        let scale = math::pow10((-expo_diff) as u32)? as i128;
        denominator = denominator
            .checked_mul(scale)
            .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    }

    require!(denominator > 0, ErrorCode::OraclePriceInvalid);
    let expected_out = numerator
        .checked_div(denominator)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    let expected_out_u64: u64 = expected_out
        .try_into()
        .map_err(|_| error!(ErrorCode::ArithmeticOverflow))?;
    let min_with_tolerance = expected_out_u64
        .checked_mul((10000 - ORACLE_SLIPPAGE_BPS) as u64)
        .and_then(|v| v.checked_div(10000 as u64))
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;
    Ok(min_with_tolerance)
}