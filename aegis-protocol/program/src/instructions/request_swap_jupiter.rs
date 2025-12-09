use anchor_lang::prelude::*;
use crate::state::*;

/// Instruction: Request a swap through Jupiter (or create pending action for large swaps)
/// 
/// Called by AI agent to execute a swap. Checks policies and either:
/// 1. Executes immediately if within daily limit and below threshold
/// 2. Creates PendingAction if amount exceeds large transaction threshold
/// 3. Rejects if daily limit would be exceeded
#[derive(Accounts)]
#[instruction(
    amount_in_lamports: u64,
    amount_out_lamports: u64,
)]
pub struct RequestSwapJupiter<'info> {
    /// The authority requesting the swap (AI agent or owner)
    /// Must be the vault's authority to execute transactions
    /// For MVP, this can be the same as owner
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// The vault that holds the funds for swapping
    /// Must be active and controlled by the authority
    /// Marked as mut because we may update daily_spent
    #[account(
        mut,
        has_one = authority,
        constraint = vault.is_active @ crate::ErrorCode::VaultNotActive,
        constraint = vault.balance >= amount_in_lamports @ crate::ErrorCode::InsufficientBalance
    )]
    pub vault: Account<'info, Vault>,
    
    /// The policy that governs this vault's spending rules
    /// Must be active and linked to the vault
    #[account(
        has_one = vault,
        constraint = policy.is_active @ crate::ErrorCode::PolicyNotActive
    )]
    pub policy: Account<'info, Policy>,
    
    /// Optional: PendingAction PDA for large transactions
    /// Only initialized if amount exceeds threshold
    /// Seeds ensure uniqueness per vault and action count
    #[account(
        init,
        payer = authority,
        space = PendingAction::SIZE,
        seeds = [
            b"pending_action", 
            vault.key().as_ref(), 
            &vault.pending_actions_count.to_le_bytes()
        ],
        bump,
        // Only create this account if we're above threshold
        constraint = amount_in_lamports > policy.large_tx_threshold_lamports @ crate::ErrorCode::BelowThreshold
    )]
    pub pending_action: Option<Account<'info, PendingAction>>,
    
    /// System program for PDA creation (if needed)
    pub system_program: Program<'info, System>,
    
    /// Clock for timestamp validation
    pub clock: Sysvar<'info, Clock>,
}

/// Handler for request_swap_jupiter instruction
/// 
/// Implements the core policy logic for AI agent swaps
pub fn handler(
    ctx: Context<RequestSwapJupiter>,
    amount_in_lamports: u64,
    amount_out_lamports: u64,
) -> Result<()> {
    require!(amount_in_lamports > 0, crate::ErrorCode::InvalidAmount);
    require!(amount_out_lamports > 0, crate::ErrorCode::InvalidAmount);
    
    let vault = &mut ctx.accounts.vault;
    let policy = &ctx.accounts.policy;
    let clock = &ctx.accounts.clock;
    
    // Check if we need to reset daily spending (new 24-hour period)
    let current_time = clock.unix_timestamp;
    let time_since_reset = current_time - vault.last_reset_timestamp;
    
    if time_since_reset >= 24 * 60 * 60 { // 24 hours in seconds
        msg!("Resetting daily spending limit");
        vault.daily_spent = 0;
        vault.last_reset_timestamp = current_time;
    }
    
    // Check daily spending limit
    let new_daily_total = vault.daily_spent.checked_add(amount_in_lamports).unwrap();
    require!(
        new_daily_total <= policy.daily_spend_limit_lamports,
        crate::ErrorCode::DailyLimitExceeded
    );
    
    // Check if this is a large transaction requiring approval
    if amount_in_lamports > policy.large_tx_threshold_lamports {
        msg!("Large transaction detected - creating pending action");
        
        // This should only happen if pending_action was created
        let pending_action = ctx.accounts.pending_action.as_ref().unwrap();

        // Initialize the pending action
        let pending_action_account = ctx.accounts.pending_action.as_mut().unwrap();
        pending_action_account.vault = vault.key();
        pending_action_account.action_type = ActionType::Swap;
        pending_action_account.amount_lamports = amount_in_lamports;
        pending_action_account.target_program = pubkey!("JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4"); // Jupiter program
        pending_action_account.target_account = vault.key(); // For now, target is vault itself
        pending_action_account.description = format!(
            "Swap {} lamports for {} lamports through Jupiter",
            amount_in_lamports,
            amount_out_lamports
        );
        pending_action_account.requester = ctx.accounts.authority.key();
        pending_action_account.requested_at = current_time;
        pending_action_account.expires_at = current_time + PENDING_ACTION_TIMEOUT;
        pending_action_account.status = ActionStatus::Pending;
        pending_action_account.approver = None;
        pending_action_account.processed_at = None;
        pending_action_account.bump = ctx.bumps.pending_action.unwrap();
        pending_action_account._reserved = [0; 7];
        
        // Update vault pending actions count
        vault.pending_actions_count = vault.pending_actions_count.checked_add(1).unwrap();
        
        msg!("Pending action created: {}", pending_action_account.key());
        msg!("Amount: {} lamports", amount_in_lamports);
        msg!("Expires at: {}", pending_action_account.expires_at);
        
    } else {
        // Small transaction - execute immediately (simulated)
        msg!("Small transaction - executing immediately (simulated)");
        
        // In a real implementation, this would:
        // 1. Call Jupiter CPI
        // 2. Update vault balance
        // 3. Execute the swap
        
        // For MVP, we just simulate by updating daily spent
        vault.daily_spent = new_daily_total;
        
        msg!("Swap executed (simulated)");
        msg!("Amount in: {} lamports", amount_in_lamports);
        msg!("Expected amount out: {} lamports", amount_out_lamports);
        msg!("Updated daily spent: {} lamports", vault.daily_spent);
    }
    
    Ok(())
}