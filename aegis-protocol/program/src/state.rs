use anchor_lang::prelude::*;
use std::mem::size_of;

/// Maximum number of allowed programs in a policy
/// Set to 5 for MVP to keep account size reasonable while supporting major DeFi protocols
pub const MAX_ALLOWED_PROGRAMS: usize = 5;

/// Maximum length for pending action description/reason
/// 200 bytes allows for detailed explanations while keeping account size manageable
pub const MAX_DESCRIPTION_LEN: usize = 200;

/// Maximum time a pending action can wait for approval (24 hours)
/// Prevents stale pending actions from cluttering the system
pub const PENDING_ACTION_TIMEOUT: i64 = 24 * 60 * 60; // 24 hours in seconds

/// Vault PDA - Holds user funds and links to spending policies
/// Seeds: [b"vault", owner_pubkey.as_ref()]
#[account]
#[derive(Debug)]
pub struct Vault {
    /// The owner of the vault who can authorize spending and policy changes
    /// This is typically the AI agent's keypair or the user's wallet
    pub owner: Pubkey,
    
    /// Authority that can execute transactions within policy limits
    /// For AI agents, this would be the agent's operational keypair
    /// Separate from owner to allow for operational vs administrative controls
    pub authority: Pubkey,
    
    /// Current balance of the vault in lamports (1 SOL = 1_000_000_000 lamports)
    /// Updated automatically on each deposit/withdrawal
    pub balance: u64,
    
    /// Total amount spent in the current 24-hour period
    /// Resets automatically when crossing the daily boundary
    /// Used to enforce daily spending limits
    pub daily_spent: u64,
    /// Timestamp when daily_spent was last reset (unix timestamp)
    /// Used to determine when a new 24-hour period begins
    pub last_reset_timestamp: i64,
    
    /// PDA of the Policy account that governs this vault
    /// One-to-one relationship: each vault has exactly one policy
    pub policy: Pubkey,
    
    /// Bump seed for the vault PDA
    /// Required for PDA validation and security
    pub bump: u8,
    
    /// Number of pending actions currently awaiting approval
    /// Used for account cleanup and status tracking
    pub pending_actions_count: u8,
    
    /// Flag to indicate if the vault is active or frozen
    /// Emergency mechanism to pause all operations
    pub is_active: bool,
    
    /// Reserved space for future upgrades
    /// Aligns the struct to 8-byte boundaries and allows for new fields
    pub _reserved: [u8; 7],
}

impl Vault {
    /// Calculate the expected size of the Vault account
    /// Used for account creation and rent exemption calculation
    pub const SIZE: usize = 8 + // discriminator
        32 + // owner
        32 + // authority  
        8 + // balance
        8 + // daily_spent
        8 + // last_reset_timestamp
        32 + // policy
        1 + // bump
        1 + // pending_actions_count
        1 + // is_active
        7; // _reserved
}

/// Policy PDA - Defines spending rules and constraints for a vault
/// Seeds: [b"policy", vault_pubkey.as_ref()]
#[account]
#[derive(Debug)]
pub struct Policy {
    /// The vault this policy governs
    /// Maintains the one-to-one relationship with Vault
    pub vault: Pubkey,
    
    /// Maximum amount that can be spent in a 24-hour period (in lamports)
    /// Prevents excessive daily spending by AI agents
    /// 0 means no limit (not recommended for production)
    pub daily_spend_limit_lamports: u64,
    
    /// Threshold above which transactions require human approval (in lamports)
    /// Balances automation with safety - small transactions are automatic
    /// Large transactions get queued for approval
    pub large_tx_threshold_lamports: u64,
    
    /// Array of program IDs that are allowed to be called
    /// Prevents AI agents from interacting with malicious or unapproved protocols
    /// Only programs in this list can be invoked through the vault
    pub allowed_programs: [Pubkey; MAX_ALLOWED_PROGRAMS],
    
    /// Number of valid entries in allowed_programs
    /// Allows for flexible policy configuration (1-5 programs)
    pub allowed_programs_count: u8,
    
    /// Bump seed for the policy PDA
    /// Required for PDA validation and security
    pub bump: u8,
    
    /// Flag indicating if the policy is currently active
    /// Allows for policy suspension without deleting the account
    pub is_active: bool,
    
    /// Minimum time between large transactions (in seconds)
    /// Prevents rapid-fire large transactions that could indicate compromise
    /// 0 means no minimum time requirement
    pub large_tx_cooldown_seconds: u32,
    
    /// Reserved space for future policy parameters
    /// Allows for policy upgrades without breaking changes
    pub _reserved: [u8; 6],
}

impl Policy {
    /// Calculate the expected size of the Policy account
    pub const SIZE: usize = 8 + // discriminator
        32 + // vault
        8 + // daily_spend_limit_lamports
        8 + // large_tx_threshold_lamports
        (32 * MAX_ALLOWED_PROGRAMS) + // allowed_programs array
        1 + // allowed_programs_count
        1 + // bump
        1 + // is_active
        4 + // large_tx_cooldown_seconds
        6; // _reserved
}

/// PendingAction PDA - Stores large operations awaiting human approval
/// Seeds: [b"pending_action", vault_pubkey.as_ref(), action_id.as_ref()]
#[account]
#[derive(Debug)]
pub struct PendingAction {
    /// The vault that this action belongs to
    /// Links the pending action to the vault and its policies
    pub vault: Pubkey,
    
    /// The transaction or operation being requested
    /// Pre-defined action types for the MVP
    pub action_type: ActionType,
    
    /// Amount involved in the action (in lamports)
    /// Used for validation and display purposes
    pub amount_lamports: u64,
    
    /// The program that will be called if approved
    /// Must be in the vault's allowed_programs list
    pub target_program: Pubkey,
    /// The account that will receive the instruction
    /// Ensures the action goes to the intended recipient
    pub target_account: Pubkey,
    
    /// Human-readable description of what this action does
    /// Helps approvers understand what they're approving
    /// Limited to MAX_DESCRIPTION_LEN characters
    pub description: String,
    
    /// Who requested this action (typically the AI agent's pubkey)
    /// Provides audit trail and accountability
    pub requester: Pubkey,
    
    /// When this action was requested (unix timestamp)
    /// Used for timeout enforcement and ordering
    pub requested_at: i64,
    
    /// When this action expires if not approved (unix timestamp)
    /// Prevents stale actions from accumulating
    /// Typically requested_at + PENDING_ACTION_TIMEOUT
    pub expires_at: i64,
    
    /// Status of the pending action
    /// Tracks approval workflow state
    pub status: ActionStatus,
    
    /// Who approved/rejected this action (if applicable)
    /// Provides audit trail for compliance
    pub approver: Option<Pubkey>,
    
    /// When this action was approved/rejected (unix timestamp)
    /// Used for audit trails and reporting
    pub processed_at: Option<i64>,
    
    /// Bump seed for the pending action PDA
    /// Required for PDA validation and security
    pub bump: u8,
    
    /// Reserved space for future workflow features
    /// Allows for approval process enhancements
    pub _reserved: [u8; 7],
}

impl PendingAction {
    /// Calculate the expected size of the PendingAction account
    /// String size is 4 (length) + MAX_DESCRIPTION_LEN bytes
    pub const SIZE: usize = 8 + // discriminator
        32 + // vault
        1 + // action_type
        8 + // amount_lamports
        32 + // target_program
        32 + // target_account
        4 + MAX_DESCRIPTION_LEN + // description string
        32 + // requester
        8 + // requested_at
        8 + // expires_at
        1 + // status
        33 + // approver (1 + 32 for Option<Pubkey>)
        17 + // processed_at (1 + 8 for Option<i64>)
        1 + // bump
        7; // _reserved
}

/// Types of actions that can be pending approval
/// Extendable for future action types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum ActionType {
    /// Large transfer of SOL or SPL tokens
    LargeTransfer,
    /// Swap operation through DEX
    Swap,
    /// Deposit to lending protocol
    LendingDeposit,
    /// Withdraw from lending protocol
    LendingWithdraw,
    /// Staking operation
    Stake,
    /// Unstaking operation
    Unstake,
    /// Custom instruction
    Custom,
}

/// Status of a pending action in the approval workflow
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum ActionStatus {
    /// Action is waiting for approval
    Pending,
    /// Action was approved and executed
    Approved,
    /// Action was rejected
    Rejected,
    /// Action expired before approval
    Expired,
    /// Action failed during execution
    Failed,
}