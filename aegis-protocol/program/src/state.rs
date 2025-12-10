use anchor_lang::prelude::*;
use crate::constants::*;

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
    pub allowed_programs: [Pubkey; MAX_ALLOWED_PROGRAMS],
    pub allowed_programs_count: u8,
    pub bump: u8,
    pub is_active: bool,
    pub large_tx_cooldown_seconds: u32,
    pub _reserved: [u8; 6],
}

impl Policy {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + (32 * MAX_ALLOWED_PROGRAMS) + 1 + 1 + 1 + 4 + 6;
}

#[account]
#[derive(Debug)]
pub struct PendingAction {
    pub vault: Pubkey,
    pub action_type: ActionType,
    pub amount_lamports: u64,
    pub target_program: Pubkey,
    pub target_account: Pubkey,
    pub min_amount_out: u64,
    pub source_token_account: Pubkey,
    pub destination_token_account: Pubkey,
    pub jupiter_accounts: Vec<u8>,
    pub jupiter_ix_data: Vec<u8>,
    pub description: String,
    pub requester: Pubkey,
    pub requested_at: i64,
    pub expires_at: i64,
    pub status: ActionStatus,
    pub approver: Option<Pubkey>,
    pub processed_at: Option<i64>,
    pub bump: u8,
    pub _reserved: [u8; 7],
}

impl PendingAction {
    pub const SIZE: usize = 8 + 32 + 1 + 8 + 32 + 32 + 8 + 32 + 32 + 4 + MAX_DESCRIPTION_LEN + 32 + 8 + 8 + 1 + 33 + 17 + 1 + 4 + MAX_JUPITER_ACCOUNTS_LEN + 4 + MAX_JUPITER_IX_DATA_LEN + 7;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum ActionType {
    LargeTransfer,
    Swap,
    LendingDeposit,
    LendingWithdraw,
    Stake,
    Unstake,
    Custom,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum ActionStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
    Failed,
}

#[account]
#[derive(Debug)]
pub struct Pool {
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub vault_a: Pubkey,
    pub vault_b: Pubkey,
    pub lp_mint: Pubkey,
    pub fee_bps: u16,
    pub lp_supply: u64,
    pub creator: Pubkey,
    pub bump: u8,
    pub vault_a_bump: u8,
    pub vault_b_bump: u8,
    pub lp_mint_bump: u8,
    pub _reserved: [u8; 5],
}

impl Pool {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 32 + 32 + 2 + 8 + 32 + 1 + 1 + 1 + 1 + 5;
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum OracleType {
    Manual,
    Pyth,
}