use anchor_lang::prelude::*;
use crate::state::*;

/// Instruction: Initialize a new vault with associated policy
/// 
/// Creates both Vault and Policy PDAs in a single atomic transaction
/// Sets up the security framework for AI agent fund management
#[derive(Accounts)]
#[instruction(
    daily_spend_limit_lamports: u64,
    large_tx_threshold_lamports: u64,
)]
pub struct InitializeVault<'info> {
    /// The human wallet that will own the vault and have final approval authority
    /// Must sign the transaction to prove ownership
    #[account(mut)]
    pub owner: Signer<'info>,
    
    /// The authority that can execute transactions within policy limits
    /// For MVP, this can be the same as owner or a separate AI agent key
    /// Using UncheckedAccount since we don't need to verify anything about this key
    /// CHECK: Authority is set by owner and can be any valid pubkey
    pub authority: UncheckedAccount<'info>,
    
    /// The Vault PDA that will hold the funds
    /// Seeds: [b"vault", owner_pubkey.as_ref()]
    /// Only one vault can exist per owner (enforced by PDA uniqueness)
    #[account(
        init,
        payer = owner,
        space = Vault::SIZE,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    /// The Policy PDA that defines spending rules for this vault
    /// Seeds: [b"policy", vault_pubkey.as_ref()]
    /// One-to-one relationship with vault (enforced by seeds)
    #[account(
        init,
        payer = owner,
        space = Policy::SIZE,
        seeds = [b"policy", vault.key().as_ref()],
        bump
    )]
    pub policy: Account<'info, Policy>,
    
    /// System program required for PDA creation
    pub system_program: Program<'info, System>,
}

pub fn initialize_vault(
    ctx: Context<InitializeVault>,
    daily_spend_limit_lamports: u64,
    large_tx_threshold_lamports: u64,
    allowed_programs: Vec<Pubkey>,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let policy = &mut ctx.accounts.policy;

    // Initialize vault state
    vault.owner = ctx.accounts.owner.key();
    vault.authority = ctx.accounts.authority.key();
    vault.balance = 0;
    vault.daily_spent = 0;
    vault.last_reset_timestamp = Clock::get()?.unix_timestamp;
    vault.policy = policy.key();
    vault.bump = ctx.bumps.vault;
    vault.pending_actions_count = 0;
    vault.is_active = true;
    vault._reserved = [0; 7];

    // Initialize policy
    policy.vault = vault.key();
    policy.daily_spend_limit_lamports = daily_spend_limit_lamports;
    policy.large_tx_threshold_lamports = large_tx_threshold_lamports;

    // Convert Vec<Pubkey> to [Pubkey; MAX_ALLOWED_PROGRAMS]
    let mut programs_array = [Pubkey::default(); 10]; // MAX_ALLOWED_PROGRAMS = 10
    let copy_len = allowed_programs.len().min(5);
    programs_array[..copy_len].copy_from_slice(&allowed_programs[..copy_len]);
    policy.allowed_programs = programs_array;
    policy.allowed_programs_count = copy_len as u8;

    policy.bump = ctx.bumps.policy;
    policy.is_active = true;
    policy.large_tx_cooldown_seconds = 0;
    policy._reserved = [0; 6];

    Ok(())
}