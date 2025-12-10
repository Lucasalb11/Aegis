use anchor_lang::prelude::*;

pub const MAX_ALLOWED_PROGRAMS: usize = 5;
pub const MAX_DESCRIPTION_LEN: usize = 200;
pub const MAX_JUPITER_ACCOUNTS_LEN: usize = 1024;
pub const MAX_JUPITER_IX_DATA_LEN: usize = 512;
pub const PENDING_ACTION_TIMEOUT: i64 = 24 * 60 * 60;
pub const BPS_DENOMINATOR: u16 = 10_000;
pub const MAX_FEE_BPS: u16 = 100;
pub const MIN_LIQUIDITY: u64 = 1_000;
pub const DAY_IN_SECONDS: i64 = 24 * 60 * 60;
pub const DEFAULT_MAX_STALENESS_SECONDS: i64 = 300;
pub const ORACLE_SLIPPAGE_BPS: u16 = 50;
pub const PYTH_PROGRAM_ID: &str = "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2ep";

#[inline]
pub fn assert_token_program(program: &AccountInfo) -> Result<()> {
    require_keys_eq!(*program.key, spl_token::ID, crate::errors::ErrorCode::InvalidTokenProgram);
    Ok(())
}