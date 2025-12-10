use anchor_lang::prelude::*;
use crate::{
    constants::{DAY_IN_SECONDS, MAX_ALLOWED_PROGRAMS, MAX_DESCRIPTION_LEN},
    errors::ErrorCode,
    state::Policy,
};

pub fn assert_positive(amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    Ok(())
}

pub fn assert_program_allowed(policy: &Policy, program_id: &Pubkey) -> Result<()> {
    for i in 0..policy.allowed_programs_count as usize {
        if policy.allowed_programs[i] == *program_id {
            return Ok(());
        }
    }
    err!(ErrorCode::ProgramNotAllowed)
}

pub fn assert_allowed_programs_len(list: &[Pubkey]) -> Result<()> {
    require!(!list.is_empty() && list.len() <= MAX_ALLOWED_PROGRAMS, ErrorCode::TooManyAllowedPrograms);
    Ok(())
}

pub fn reset_daily_if_needed(vault: &mut crate::state::Vault, now: i64) {
    let elapsed = now.saturating_sub(vault.last_reset_timestamp);
    if elapsed >= DAY_IN_SECONDS {
        vault.daily_spent = 0;
        vault.last_reset_timestamp = now;
    }
}

pub fn record_daily_spend(vault: &mut crate::state::Vault, policy: &Policy, amount: u64) -> Result<()> {
    let next = vault.daily_spent.checked_add(amount).ok_or(ErrorCode::ArithmeticOverflow)?;
    require!(next <= policy.daily_spend_limit_lamports, ErrorCode::DailyLimitExceeded);
    vault.daily_spent = next;
    Ok(())
}

pub fn assert_description_len(desc: &str) -> Result<()> {
    require!(desc.len() <= MAX_DESCRIPTION_LEN, ErrorCode::DescriptionTooLong);
    Ok(())
}

pub fn assert_staleness(max_staleness: i64, current_ts: i64, last_update_ts: i64) -> Result<()> {
    require!(max_staleness > 0, ErrorCode::InvalidAmount);
    if current_ts > 0 && last_update_ts > 0 {
        let staleness = current_ts.saturating_sub(last_update_ts);
        require!(staleness <= max_staleness, ErrorCode::OraclePriceInvalid);
    }
    Ok(())
}