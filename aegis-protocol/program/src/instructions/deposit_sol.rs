use anchor_lang::prelude::*;
use anchor_lang::solana_program::{system_program, system_instruction};
use crate::state::*;

/// Instruction: Deposit SOL into the vault
/// 
/// Transfers SOL from the owner's wallet to the vault PDA
/// The vault PDA gains control of the funds, not the user
#[derive(Accounts)]
pub struct DepositSol<'info> {
    /// The vault owner who is depositing funds
    /// Must be the same pubkey that created the vault
    /// Must sign to authorize the transfer from their wallet
    #[account(mut)]
    pub owner: Signer<'info>,
    
    /// The vault PDA that will receive and control the funds
    /// Must be owned by the owner (enforced by seeds)
    /// Marked as mut because we're updating the balance
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key() @ crate::ErrorCode::VaultOwnerMismatch,
        constraint = vault.is_active @ crate::ErrorCode::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,
    
    /// System program required for SOL transfers
    pub system_program: Program<'info, System>,
}

// Handler removed - implemented directly in lib.rs