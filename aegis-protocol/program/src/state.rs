use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct Pool {
    // Core pool data
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub vault_a: Pubkey,
    pub vault_b: Pubkey,
    pub lp_mint: Pubkey,
    pub fee_bps: u16,
    pub lp_supply: u64,
    pub creator: Pubkey,
    pub created_at: i64,
    pub bump: u8,
    pub vault_a_bump: u8,
    pub vault_b_bump: u8,
    pub lp_mint_bump: u8,

    // Security features
    pub emergency_mode: bool,
    pub max_daily_volume: u64,
    pub current_daily_volume: u64,
    pub last_volume_reset: i64,

    // Upgradeability
    pub version: u8,
    pub features_flags: u32,

    // Tokenomics tracking
    pub reward_points: u128,
    pub swap_count: u64,
    pub last_reward_claim_ts: i64,

    // Future expansion
    pub _reserved: [u8; 32],
}

impl Pool {
    pub const SIZE: usize = 8 // discriminator
        + 32 + 32 + 32 + 32 + 32 // pubkeys
        + 2 // fee_bps
        + 8 // lp_supply
        + 32 // creator
        + 8 // created_at
        + 1 + 1 + 1 + 1 // bumps and flags
        + 8 + 8 + 8 // volume tracking
        + 1 + 4 // version + feature flags
        + 16 // reward_points
        + 8 // swap_count
        + 8 // last_reward_claim_ts
        + 32; // reserved
}

#[account]
#[derive(Debug)]
pub struct EmissionVault {
    pub bump: u8,
    pub last_distribution_ts: i64,
    pub week_counter: u32,
    pub total_emitted: u128,
    pub weekly_amount: u64,
    pub reward_mint: Pubkey,
    pub emission_token_account: Pubkey,
    pub lm_vault: Pubkey,
    pub team_vault: Pubkey,
    pub ecosystem_vault: Pubkey,
    pub _reserved: [u8; 16],
}

impl EmissionVault {
    pub const SIZE: usize = 8 // discriminator
        + 1 // bump
        + 8 // last_distribution_ts
        + 4 // week_counter
        + 16 // total_emitted
        + 8 // weekly_amount
        + 32 * 5 // pubkeys
        + 16; // reserved
}

#[account]
#[derive(Debug)]
pub struct TeamVesting {
    pub bump: u8,
    pub start_ts: i64,
    pub cliff_end_ts: i64,
    pub linear_end_ts: i64,
    pub claimed: u64,
    pub vault: Pubkey,
    pub treasury: Pubkey,
    pub guardians: [Pubkey; 7],
    pub threshold: u8,
    pub _reserved: [u8; 7],
}

impl TeamVesting {
    pub const SIZE: usize = 8 // discriminator
        + 1 // bump
        + 8 * 3 // timestamps
        + 8 // claimed
        + 32 * 2 // vault + treasury
        + 32 * 7 // guardians
        + 1 // threshold
        + 7; // reserved
}

#[account]
#[derive(Debug)]
pub struct Vault {
    pub owner: Pubkey,
    pub authority: Pubkey,
    pub balance: u64,
    pub daily_spent: u64,
    pub last_reset_timestamp: i64,
    pub policy: Pubkey,
    pub bump: u8,
    pub pending_actions_count: u8,
    pub is_active: bool,
    pub _reserved: [u8; 7],
}

impl Vault {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 32 + 1 + 1 + 1 + 7;
}

#[account]
#[derive(Debug)]
pub struct Policy {
    pub vault: Pubkey,
    pub daily_spend_limit_lamports: u64,
    pub large_tx_threshold_lamports: u64,
    pub allowed_programs: [Pubkey; 10],
    pub allowed_programs_count: u8,
    pub bump: u8,
    pub is_active: bool,
    pub large_tx_cooldown_seconds: u32,
    pub _reserved: [u8; 6],
}

impl Policy {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + (32 * 10) + 1 + 1 + 1 + 4 + 6;
}

#[account]
#[derive(Debug)]
pub struct OracleConfig {
    pub pool: Pubkey,
    pub feed_a: Pubkey,
    pub feed_b: Pubkey,
    pub price_a: i64,
    pub price_b: i64,
    pub expo_a: i32,
    pub expo_b: i32,
    pub max_staleness_seconds: i64,
    pub last_updated_ts: i64,
    pub authority: Pubkey,
    pub oracle_type: OracleType,
    pub bump: u8,
    pub _reserved: [u8; 7],
}

impl OracleConfig {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 4 + 4 + 8 + 8 + 32 + 1 + 1 + 7;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum OracleType {
    Manual,
    Pyth,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum ActionStatus {
    Pending,
    Approved,
    Rejected,
    Executed,
    Expired,
}

#[account]
#[derive(Debug)]
pub struct PendingAction {
    pub vault: Pubkey,
    pub requester: Pubkey,
    pub action_type: ActionType,
    pub status: ActionStatus,
    pub created_at: i64,
    pub expires_at: i64,
    pub amount_lamports: u64,
    pub target_program: Pubkey,
    pub target_account: Pubkey,
    pub description: String,
    pub requested_at: i64,
    pub approver: Option<Pubkey>,
    pub processed_at: Option<i64>,
    pub bump: u8,
    pub _reserved: [u8; 7],
}

impl PendingAction {
    pub const SIZE: usize = 8 + 32 + 32 + 1 + 1 + 8 + 8 + 8 + 32 + 32 + (4 + 200) + 8 + (1 + 32) + (1 + 8) + 1 + 7; // Approximate size
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum ActionType {
    Swap,
    Transfer,
    Withdraw,
    LargeTransfer,
}