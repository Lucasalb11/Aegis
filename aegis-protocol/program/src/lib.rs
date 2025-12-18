pub mod constants;
pub mod errors;
pub mod instructions;
pub mod seeds;
pub mod pool;
pub mod math;
pub mod validation;
pub mod state;

pub use errors::ErrorCode;
pub use state::*;
use instructions::*;
use anchor_lang::prelude::*;

declare_id!("AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu");

#[program]
pub mod aegis_protocol {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, fee_bps: u16) -> Result<()> {
        instructions::pool::initialize_pool(ctx, fee_bps)
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
        instructions::pool::add_liquidity(ctx, amount_a, amount_b)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, lp_amount: u64) -> Result<()> {
        instructions::pool::remove_liquidity(ctx, lp_amount)
    }

    pub fn swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64, a_to_b: bool) -> Result<()> {
        instructions::pool::swap(ctx, amount_in, min_amount_out, a_to_b)
    }

    pub fn health_check(ctx: Context<HealthCheck>) -> Result<()> {
        instructions::pool::health_check(ctx)
    }

    pub fn initialize_emission_vault_core(ctx: Context<InitializeEmissionVaultCore>) -> Result<()> {
        instructions::tokenomics::initialize_emission_vault_core(ctx)
    }


    pub fn distribute_weekly_rewards(ctx: Context<DistributeWeeklyRewards>) -> Result<()> {
        instructions::tokenomics::distribute_weekly_rewards(ctx)
    }

    pub fn claim_pool_rewards(ctx: Context<ClaimPoolRewards>) -> Result<()> {
        instructions::tokenomics::claim_pool_rewards(ctx)
    }
}