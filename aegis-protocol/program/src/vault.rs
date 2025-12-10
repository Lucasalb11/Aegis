use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    system_instruction,
};
use crate::{
    constants::*,
    errors::ErrorCode,
    math,
    seeds,
    state::*,
    validation,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SerializableAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

#[derive(Accounts)]
#[instruction(
    daily_spend_limit_lamports: u64,
    large_tx_threshold_lamports: u64,
    allowed_programs: Vec<Pubkey>
)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
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
        constraint = vault.owner == owner.key() @ ErrorCode::VaultOwnerMismatch,
        constraint = vault.is_active @ ErrorCode::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_vault(
    ctx: Context<InitializeVault>,
    daily_spend_limit_lamports: u64,
    large_tx_threshold_lamports: u64,
    allowed_programs: Vec<Pubkey>,
) -> Result<()> {
    validation::assert_positive(daily_spend_limit_lamports)?;
    validation::assert_positive(large_tx_threshold_lamports)?;
    require!(
        large_tx_threshold_lamports <= daily_spend_limit_lamports,
        ErrorCode::ThresholdExceedsDailyLimit
    );
    validation::assert_allowed_programs_len(&allowed_programs)?;

    let clock = Clock::get()?;
    let vault = &mut ctx.accounts.vault;
    let policy = &mut ctx.accounts.policy;

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
    policy.allowed_programs = [Pubkey::default(); MAX_ALLOWED_PROGRAMS];
    for (i, pk) in allowed_programs.iter().enumerate() {
        policy.allowed_programs[i] = *pk;
    }
    policy.allowed_programs_count = allowed_programs.len() as u8;
    policy.bump = ctx.bumps.policy;
    policy.is_active = true;
    policy.large_tx_cooldown_seconds = 0;
    policy._reserved = [0; 6];
    Ok(())
}

pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    validation::assert_positive(amount)?;
    let vault = &mut ctx.accounts.vault;
    let owner = &ctx.accounts.owner;

    vault.balance = math::add_u64(vault.balance, amount)?;
    let transfer_instruction = system_instruction::transfer(&owner.key(), &vault.key(), amount);
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            owner.to_account_info(),
            vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    Ok(())
}