use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod math;
pub mod seeds;
pub mod state;
pub mod token_utils;
pub mod validation;

pub use errors::ErrorCode;
pub use state::*;

// Import instruction modules
mod vault;
mod pool;
mod oracle;

declare_id!("AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu");

#[program]
pub mod aegis_protocol {

    pub fn initialize_vault(
        ctx: Context<vault::InitializeVault>,
        daily_spend_limit_lamports: u64,
        large_tx_threshold_lamports: u64,
        allowed_programs: Vec<Pubkey>,
    ) -> Result<()> {
        vault::initialize_vault(ctx, daily_spend_limit_lamports, large_tx_threshold_lamports, allowed_programs)
    }

    pub fn deposit_sol(ctx: Context<vault::DepositSol>, amount: u64) -> Result<()> {
        vault::deposit_sol(ctx, amount)
    }

    pub fn withdraw_sol(ctx: Context<vault::WithdrawSol>, amount: u64) -> Result<()> {
        vault::withdraw_sol(ctx, amount)
    }

    pub fn withdraw_spl(ctx: Context<vault::WithdrawSpl>, amount: u64) -> Result<()> {
        vault::withdraw_spl(ctx, amount)
    }

    pub fn request_swap_jupiter(
        ctx: Context<vault::RequestSwapJupiter>,
        amount_in: u64,
        amount_out_min: u64,
        jupiter_accounts: Vec<u8>,
        jupiter_data: Vec<u8>,
    ) -> Result<()> {
        vault::request_swap_jupiter(ctx, amount_in, amount_out_min, jupiter_accounts, jupiter_data)
    }

    pub fn approve_pending_action(ctx: Context<vault::ApprovePendingAction>) -> Result<()> {
        vault::approve_pending_action(ctx)
    }

    pub fn reject_pending_action(ctx: Context<vault::RejectPendingAction>) -> Result<()> {
        vault::reject_pending_action(ctx)
    }

    pub fn expire_pending_action(ctx: Context<vault::ExpirePendingAction>) -> Result<()> {
        vault::expire_pending_action(ctx)
    }

    pub fn initialize_pool(ctx: Context<pool::InitializePool>, fee_bps: u16) -> Result<()> {
        pool::initialize_pool(ctx, fee_bps)
    }

    pub fn add_liquidity(ctx: Context<pool::AddLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
        pool::add_liquidity(ctx, amount_a, amount_b)
    }

    pub fn remove_liquidity(ctx: Context<pool::RemoveLiquidity>, lp_amount: u64) -> Result<()> {
        pool::remove_liquidity(ctx, lp_amount)
    }

    pub fn swap(
        ctx: Context<pool::Swap>,
        amount_in: u64,
        min_amount_out: u64,
        a_to_b: bool,
    ) -> Result<()> {
        pool::swap(ctx, amount_in, min_amount_out, a_to_b)
    }

    pub fn configure_oracle(
        ctx: Context<oracle::ConfigureOracle>,
        oracle_type: OracleType,
        feed_a: Pubkey,
        feed_b: Pubkey,
        max_staleness_seconds: i64,
    ) -> Result<()> {
        oracle::configure_oracle(ctx, oracle_type, feed_a, feed_b, max_staleness_seconds)
    }

    pub fn update_oracle_manual(
        ctx: Context<oracle::UpdateOracleManual>,
        price_a: i64,
        expo_a: i32,
        price_b: i64,
        expo_b: i32,
    ) -> Result<()> {
        oracle::update_oracle_manual(ctx, price_a, expo_a, price_b, expo_b)
    }

    pub fn update_oracle_from_pyth(ctx: Context<oracle::UpdateOracleFromPyth>) -> Result<()> {
        oracle::update_oracle_from_pyth(ctx)
    }
}