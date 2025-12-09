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

// Handler removed - implemented directly in lib.rs