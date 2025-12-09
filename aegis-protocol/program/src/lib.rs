use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, instruction::AccountMeta};

pub mod state;
pub mod instructions;
pub use state::*;
pub use instructions::*;

#[derive(Accounts)]
#[instruction(daily_spend_limit_lamports: u64, large_tx_threshold_lamports: u64)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Authority is set by owner and can be any valid pubkey
    pub authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = Vault::SIZE,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        space = Policy::SIZE,
        seeds = [b"policy", vault.key().as_ref()],
        bump
    )]
    pub policy: Account<'info, Policy>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key() @ crate::ErrorCode::VaultOwnerMismatch,
        constraint = vault.is_active @ crate::ErrorCode::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(
    amount_in: u64,
    amount_out_min: u64,
    jupiter_accounts: Vec<u8>,  // Serialized Jupiter account metas
    jupiter_data: Vec<u8>,      // Serialized Jupiter instruction data
)]
pub struct RequestSwapJupiter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority,
        constraint = vault.is_active @ crate::ErrorCode::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    /// Token account source (SOL/wSOL)
    #[account(mut)]
    pub source_token_account: UncheckedAccount<'info>,

    /// Token account destination (USDC)
    #[account(mut)]
    pub destination_token_account: UncheckedAccount<'info>,

    #[account(
        has_one = vault,
        constraint = policy.is_active @ crate::ErrorCode::PolicyNotActive
    )]
    pub policy: Account<'info, Policy>,

    /// Optional: PendingAction PDA for large transactions
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
        constraint = amount_in > policy.large_tx_threshold_lamports @ crate::ErrorCode::BelowThreshold
    )]
    pub pending_action: Option<Account<'info, PendingAction>>,

    /// Jupiter program
    /// CHECK: Validated by instruction data
    #[account(address = pubkey!("JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4"))]
    pub jupiter_program: UncheckedAccount<'info>,

    /// Jupiter accounts (remaining accounts passed to CPI)
    pub jupiter_accounts: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct ApprovePendingAction<'info> {
    /// The vault owner who must approve the action
    /// Must be the same pubkey that created the vault
    /// Must sign to prove authorization
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The vault that owns this pending action
    /// Must be controlled by the owner
    /// Must be active to execute actions
    /// Marked as mut because we update daily_spent and pending_actions_count
    #[account(
        mut,
        has_one = owner,
        constraint = vault.is_active @ crate::ErrorCode::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    /// The pending action to approve
    /// Must belong to the vault and be in pending status
    /// Must not be expired
    /// Marked as mut because we're updating its status
    /// Validates ownership, status, and expiration constraints
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

// Helper function to execute Jupiter swap via CPI
fn execute_jupiter_swap<'info>(
    source_token_account: AccountInfo<'info>,
    destination_token_account: AccountInfo<'info>,
    jupiter_program: AccountInfo<'info>,
    vault_key: Pubkey,
    vault_bump: u8,
    jupiter_data: &[u8],
) -> Result<()> {
    // Build Jupiter instruction from serialized data
    // This is a simplified version - in production you'd deserialize the full instruction
    let jupiter_ix = Instruction {
        program_id: jupiter_program.key(),
        accounts: vec![
            AccountMeta::new(source_token_account.key(), false),
            AccountMeta::new(destination_token_account.key(), false),
            AccountMeta::new_readonly(vault_key, true), // Vault PDA as authority
        ],
        data: jupiter_data.to_vec(),
    };

    // Vault PDA seeds for signing
    let vault_seeds = &[
        b"vault",
        vault_key.as_ref(),
        &[vault_bump],
    ];

    // Execute CPI with vault PDA signature
    // Note: In production, you'd need all Jupiter-required accounts
    anchor_lang::solana_program::program::invoke_signed(
        &jupiter_ix,
        &[
            source_token_account,
            destination_token_account,
            // Jupiter program and other required accounts would go here
        ],
        &[vault_seeds],
    )?;

    Ok(())
}

declare_id!("3ocZbHXDgRAS32T6XqKwfPZGFwUwz6H5bJNsF2MoptrU");

#[program]
pub mod aegis_protocol {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        daily_spend_limit_lamports: u64,
        large_tx_threshold_lamports: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let policy = &mut ctx.accounts.policy;
        let clock = Clock::get()?;

        require!(daily_spend_limit_lamports > 0, crate::ErrorCode::InvalidDailyLimit);
        require!(large_tx_threshold_lamports > 0, crate::ErrorCode::InvalidThreshold);
        require!(
            large_tx_threshold_lamports <= daily_spend_limit_lamports,
            crate::ErrorCode::ThresholdExceedsDailyLimit
        );
        vault.owner = ctx.accounts.owner.key();
        vault.authority = ctx.accounts.authority.key();
        vault.balance = 0;
        vault.daily_spent = 0;
        vault.last_reset_timestamp = clock.unix_timestamp;
        vault.policy = policy.key();
        vault.bump = ctx.bumps.vault;
        vault.pending_actions_count = 0;
        vault.is_active = true;
        vault._reserved = [0; 7];

        policy.vault = vault.key();
        policy.daily_spend_limit_lamports = daily_spend_limit_lamports;
        policy.large_tx_threshold_lamports = large_tx_threshold_lamports;

        let jupiter_program = pubkey!("JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4");
        policy.allowed_programs = [Pubkey::default(); MAX_ALLOWED_PROGRAMS];
        policy.allowed_programs[0] = jupiter_program;
        policy.allowed_programs_count = 1;

        policy.bump = ctx.bumps.policy;
        policy.is_active = true;
        policy.large_tx_cooldown_seconds = 300;
        policy._reserved = [0; 6];

        msg!("Vault initialized: {}", vault.key());

        Ok(())
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        require!(amount > 0, crate::ErrorCode::InvalidAmount);

        let vault = &mut ctx.accounts.vault;
        let owner = &ctx.accounts.owner;

        vault.balance = vault.balance.checked_add(amount).unwrap();

        let transfer_instruction = system_instruction::transfer(
            &owner.key(),
            &vault.key(),
            amount
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                owner.to_account_info(),
                vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!("Deposited {} lamports to vault {}", amount, vault.key());
        Ok(())
    }

    pub fn request_swap_jupiter(
        ctx: Context<RequestSwapJupiter>,
        amount_in: u64,
        amount_out_min: u64,
        jupiter_accounts: Vec<u8>,
        jupiter_data: Vec<u8>,
    ) -> Result<()> {
        require!(amount_in > 0, crate::ErrorCode::InvalidAmount);
        require!(amount_out_min > 0, crate::ErrorCode::InvalidAmount);

        let vault_key = ctx.accounts.vault.key();
        let vault_bump = ctx.accounts.vault.bump;
        let authority_key = ctx.accounts.authority.key();
        let source_token_key = ctx.accounts.source_token_account.key();
        let policy = &ctx.accounts.policy;
        let clock = &ctx.accounts.clock;
        let current_time = clock.unix_timestamp;

        // Check daily reset
        let mut daily_spent = ctx.accounts.vault.daily_spent;
        let time_since_reset = current_time - ctx.accounts.vault.last_reset_timestamp;
        if time_since_reset >= 24 * 60 * 60 {
            daily_spent = 0;
        }

        if amount_in > policy.large_tx_threshold_lamports {
            // Create pending action for large transactions
            let vault = &mut ctx.accounts.vault;
            let pending_action = ctx.accounts.pending_action.as_mut().unwrap();

            // Update vault state for reset
            if time_since_reset >= 24 * 60 * 60 {
                vault.daily_spent = 0;
                vault.last_reset_timestamp = current_time;
            }

            pending_action.vault = vault_key;
            pending_action.action_type = ActionType::Swap;
            pending_action.amount_lamports = amount_in;
            pending_action.target_program = pubkey!("JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4");
            pending_action.target_account = source_token_key;

            pending_action.description = format!("Jupiter swap: {} in, {} min out", amount_in, amount_out_min);
            pending_action.requester = authority_key;
            pending_action.requested_at = current_time;
            pending_action.expires_at = current_time + PENDING_ACTION_TIMEOUT;
            pending_action.status = ActionStatus::Pending;
            pending_action.approver = None;
            pending_action.processed_at = None;
            pending_action.bump = ctx.bumps.pending_action.unwrap();
            pending_action._reserved = [0; 7];

            vault.pending_actions_count = vault.pending_actions_count.checked_add(1).unwrap();
            msg!("Pending swap action created: {} lamports", amount_in);
        } else {
            // Execute swap immediately for small transactions
            let new_daily_total = daily_spent.checked_add(amount_in)
                .ok_or(crate::ErrorCode::DailyLimitExceeded)?;

            if new_daily_total > policy.daily_spend_limit_lamports {
                return err!(crate::ErrorCode::DailyLimitExceeded);
            }

            // Execute Jupiter CPI
            execute_jupiter_swap(
                ctx.accounts.source_token_account.to_account_info(),
                ctx.accounts.destination_token_account.to_account_info(),
                ctx.accounts.jupiter_program.to_account_info(),
                vault_key,
                vault_bump,
                &jupiter_data,
            )?;

            // Update vault state
            let vault = &mut ctx.accounts.vault;
            vault.daily_spent = new_daily_total;
            if time_since_reset >= 24 * 60 * 60 {
                vault.last_reset_timestamp = current_time;
            }

            msg!("Jupiter swap executed: {} in, {} min out", amount_in, amount_out_min);
        }

        Ok(())
    }

    pub fn approve_pending_action(ctx: Context<ApprovePendingAction>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let pending_action = &mut ctx.accounts.pending_action;
        let clock = &ctx.accounts.clock;
        let current_time = clock.unix_timestamp;

        require!(current_time < pending_action.expires_at, crate::ErrorCode::ActionExpired);

        let time_since_reset = current_time - vault.last_reset_timestamp;
        if time_since_reset >= 24 * 60 * 60 {
            vault.daily_spent = 0;
            vault.last_reset_timestamp = current_time;
        }

        let new_daily_total = vault.daily_spent.checked_add(pending_action.amount_lamports)
            .ok_or(crate::ErrorCode::DailyLimitExceeded)?;

        // For Jupiter swaps, we need additional accounts - this is a simplified version
        // In production, you'd need to pass the Jupiter accounts to approve_pending_action
        match pending_action.action_type {
            ActionType::Swap => {
                // TODO: Execute Jupiter swap with stored data from pending action
                // For now, just approve without executing Jupiter CPI
                msg!("Jupiter swap approved - execution would happen here");
            }
            _ => {}
        }

        pending_action.status = ActionStatus::Approved;
        pending_action.approver = Some(ctx.accounts.owner.key());
        pending_action.processed_at = Some(current_time);

        vault.daily_spent = new_daily_total;
        vault.pending_actions_count = vault.pending_actions_count.saturating_sub(1);

        msg!("Approved pending action: {} lamports", pending_action.amount_lamports);
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("Daily spend limit must be greater than zero")]
    InvalidDailyLimit,
    
    #[msg("Large transaction threshold must be greater than zero")]
    InvalidThreshold,
    
    #[msg("Large transaction threshold cannot exceed daily limit")]
    ThresholdExceedsDailyLimit,
    
    #[msg("Too many allowed programs")]
    TooManyAllowedPrograms,
    
    #[msg("Description too long")]
    DescriptionTooLong,
    
    #[msg("Transaction amount is below the large transaction threshold")]
    TransactionBelowThreshold,
    
    #[msg("Target program is not in the allowed programs list")]
    ProgramNotAllowed,
    
    #[msg("Daily spending limit exceeded")]
    DailyLimitExceeded,
    
    #[msg("Action is not in pending status")]
    ActionNotPending,
    
    #[msg("Action has expired")]
    ActionExpired,
    
    #[msg("Vault owner mismatch")]
    VaultOwnerMismatch,
    
    #[msg("Vault is not active")]
    VaultNotActive,
    
    #[msg("Policy is not active")]
    PolicyNotActive,
    
    #[msg("Insufficient balance in vault")]
    InsufficientBalance,

    #[msg("Token account does not belong to vault")]
    InvalidTokenAccount,

    #[msg("Below large transaction threshold")]
    BelowThreshold,
}