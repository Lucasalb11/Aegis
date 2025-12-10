use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

pub use errors::ErrorCode;
pub use state::*;

declare_id!("AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu");

#[program]
pub mod aegis_protocol {
    use super::*;

    /// Creates a concentrated pool with enhanced security features
    /// Includes circuit breaker protection and comprehensive validation
    pub fn initialize_pool(ctx: Context<InitializePool>, fee_bps: u16) -> Result<()> {
        instructions::pool::initialize_pool(ctx, fee_bps)
    }

    /// Adds liquidity with overflow protection and reentrancy guards
    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
        instructions::pool::add_liquidity(ctx, amount_a, amount_b)
    }

    /// Removes liquidity with safe math operations
    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, lp_amount: u64) -> Result<()> {
        instructions::pool::remove_liquidity(ctx, lp_amount)
    }

    /// Performs secure swap with slippage protection and circuit breakers
    pub fn swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64, a_to_b: bool) -> Result<()> {
        instructions::pool::swap(ctx, amount_in, min_amount_out, a_to_b)
    }

    /// Health check for monitoring pool status
    pub fn health_check(ctx: Context<HealthCheck>) -> Result<()> {
        instructions::pool::health_check(ctx)
    }
}

// Enhanced account structs with security improvements
#[derive(Accounts)]
#[instruction(fee_bps: u16)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Mint validation done in instruction handler
    #[account(constraint = mint_a.key() != mint_b.key() @ ErrorCode::InvalidAmount)]
    pub mint_a: AccountInfo<'info>,

    /// CHECK: Mint validation done in instruction handler
    pub mint_b: AccountInfo<'info>,

    #[account(
        init,
        payer = payer,
        space = Pool::SIZE,
        seeds = [POOL_SEED, mint_a.key().as_ref(), mint_b.key().as_ref(), &[0]],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    /// CHECK: Token accounts created with proper authority
    pub vault_a: AccountInfo<'info>,

    /// CHECK: Token accounts created with proper authority
    pub vault_b: AccountInfo<'info>,

    /// CHECK: LP mint created with proper authority
    pub lp_mint: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED, pool.mint_a.as_ref(), pool.mint_b.as_ref(), &[pool.bump]],
        bump = pool.bump,
        constraint = pool.emergency_mode == false @ ErrorCode::CooldownNotElapsed
    )]
    pub pool: Account<'info, Pool>,

    /// CHECK: Token accounts validated by program
    pub user_token_a: AccountInfo<'info>,
    /// CHECK: Token accounts validated by program
    pub user_token_b: AccountInfo<'info>,
    /// CHECK: LP token account
    pub user_lp_token: AccountInfo<'info>,

    pub token_program: Program<'info, anchor_spl::token::Token>,
}


#[derive(Accounts)]
pub struct HealthCheck<'info> {
    #[account(
        seeds = [POOL_SEED, pool.mint_a.as_ref(), pool.mint_b.as_ref(), &[pool.bump]],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
}

// Additional account structs
#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: Token accounts
    pub user_token_a: AccountInfo<'info>,
    /// CHECK: Token accounts
    pub user_token_b: AccountInfo<'info>,
    /// CHECK: LP token account
    pub user_lp_token: AccountInfo<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: Token accounts
    pub user_source: AccountInfo<'info>,
    /// CHECK: Token accounts
    pub user_destination: AccountInfo<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
}

// Constants for PDA seeds
#[constant]
pub const POOL_SEED: &[u8] = b"pool";