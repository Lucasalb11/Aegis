use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
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

pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require!(amount > 0, crate::ErrorCode::InvalidAmount);

    let vault = &mut ctx.accounts.vault;
    let owner = &ctx.accounts.owner;

    // Transfer SOL from owner to vault
    let transfer_ix = system_instruction::transfer(
        &owner.key(),
        &vault.key(),
        amount,
    );

    anchor_lang::solana_program::program::invoke(
        &transfer_ix,
        &[
            owner.to_account_info(),
            vault.to_account_info(),
        ],
    )?;

    // Update vault balance
    vault.balance = vault.balance.checked_add(amount).unwrap();

    msg!("Deposited {} lamports to vault", amount);
    msg!("New vault balance: {} lamports", vault.balance);

    Ok(())
}