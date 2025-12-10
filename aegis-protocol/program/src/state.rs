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

    // Security features
    pub emergency_mode: bool,
    pub max_daily_volume: u64,
    pub current_daily_volume: u64,
    pub last_volume_reset: i64,

    // Upgradeability
    pub version: u8,
    pub features_flags: u32,

    // Future expansion
    pub _reserved: [u8; 64],
}

impl Pool {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 32 + 32 + 2 + 8 + 32 + 8 + 1 + 1 + 8 + 8 + 8 + 1 + 4 + 64;
}

#[account]
#[derive(Debug)]
pub struct EmissionVault {
    pub bump: u8,
    pub last_distribution_ts: u64,
    pub weekly_amount: u64,
    pub _reserved: [u8; 5],
}

impl EmissionVault {
    pub const SIZE: usize = 8 + 1 + 8 + 8 + 5;
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