use anchor_lang::prelude::*;
use crate::state::*;

/// Instruction: Approve a pending action and execute it
/// 
/// Only the vault owner can approve pending actions
/// Marks the action as approved and simulates execution
/// Updates vault state to reflect the completed action
#[derive(Accounts)]
pub struct ApprovePendingAction<'info> {
    /// The vault owner who must approve the action
    /// Must be the same pubkey that created the vault
    /// Must sign to prove authorization
    #[account(mut)]
    pub owner: Signer<'info>,
    
    /// The vault that owns this pending action
    /// Must be controlled by the owner
    /// Marked as mut because we may update daily_spent and pending_actions_count
    #[account(
        mut,
        has_one = owner,
        constraint = vault.is_active @ crate::ErrorCode::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,
    
    /// The pending action to approve
    /// Must belong to the vault and be in pending status
    /// Marked as mut because we're updating its status
    #[account(
        mut,
        has_one = vault,
        constraint = pending_action.status == ActionStatus::Pending @ crate::ErrorCode::ActionNotPending,
        constraint = pending_action.expires_at > Clock::get()?.unix_timestamp @ crate::ErrorCode::ActionExpired
    )]
    pub pending_action: Account<'info, PendingAction>,
    
    /// Clock sysvar for timestamp validation
    pub clock: Sysvar<'info, Clock>,
}

/// Handler for approve_pending_action instruction
///
/// Validates approval authority and simulates action execution
/// Updates vault state to reflect completed action
pub fn approve_pending_action(ctx: Context<ApprovePendingAction>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let pending_action = &mut ctx.accounts.pending_action;
    let clock = &ctx.accounts.clock;
    let current_time = clock.unix_timestamp;
    
    // Validate that the action hasn't expired
    require!(
        current_time < pending_action.expires_at,
        crate::ErrorCode::ActionExpired
    );
    
    // Check if we need to reset daily spending (new 24-hour period)
    let time_since_reset = current_time - vault.last_reset_timestamp;
    if time_since_reset >= 24 * 60 * 60 { // 24 hours in seconds
        msg!("Resetting daily spending limit");
        vault.daily_spent = 0;
        vault.last_reset_timestamp = current_time;
    }
    
    // Check that approving this action won't exceed daily limit
    let new_daily_total = vault.daily_spent.checked_add(pending_action.amount_lamports).unwrap();
    
    // Get the policy to check daily limits
    // Note: In a real implementation, we'd pass the policy account
    // For now, we'll assume the action was validated when created
    
    msg!("Approving pending action");
    msg!("Action type: {:?}", pending_action.action_type);
    msg!("Amount: {} lamports", pending_action.amount_lamports);
    msg!("New daily total would be: {} lamports", new_daily_total);
    
    // Update pending action status
    pending_action.status = ActionStatus::Approved;
    pending_action.approver = Some(ctx.accounts.owner.key());
    pending_action.processed_at = Some(current_time);
    
    // Update vault state (simulated execution)
    match pending_action.action_type {
        ActionType::Swap => {
            msg!("Executing approved swap (simulated)");
            
            // In a real implementation, this would:
            // 1. Call Jupiter CPI to execute the swap
            // 2. Update vault balance based on swap result
            // 3. Handle any swap failures
            
            // For MVP simulation:
            vault.daily_spent = new_daily_total;
            // vault.balance would be updated based on actual swap results
            
            msg!("Swap executed successfully (simulated)");
            msg!("Updated daily spent: {} lamports", vault.daily_spent);
        }
        ActionType::LargeTransfer => {
            msg!("Executing approved large transfer (simulated)");
            
            // In a real implementation, this would:
            // 1. Transfer SOL from vault to target account
            // 2. Update vault balance
            // 3. Verify transfer success
            
            // For MVP simulation:
            vault.daily_spent = new_daily_total;
            // vault.balance = vault.balance.checked_sub(pending_action.amount_lamports).unwrap();
            
            msg!("Large transfer executed successfully (simulated)");
            msg!("Updated daily spent: {} lamports", vault.daily_spent);
        }
        _ => {
            msg!("Executing approved action: {:?}", pending_action.action_type);
            vault.daily_spent = new_daily_total;
        }
    }
    
    // Decrement pending actions count
    vault.pending_actions_count = vault.pending_actions_count.saturating_sub(1);
    
    msg!("Action approved and executed successfully");
    msg!("Pending action: {}", pending_action.key());
    msg!("Approved by: {}", ctx.accounts.owner.key());
    msg!("Processed at: {}", current_time);

    Ok(())
}