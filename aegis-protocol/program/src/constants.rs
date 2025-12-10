/// Maximum fee in basis points (100% = 10000)
pub const MAX_FEE_BPS: u16 = 10000;

/// Denominator for basis points calculations
pub const BPS_DENOMINATOR: u64 = 10000;

/// Minimum liquidity to prevent division by zero
pub const MIN_LIQUIDITY: u64 = 1000;

/// AEGIS token decimals
pub const AEGIS_DECIMALS: u8 = 9;

/// Initial AEGIS mint amount (1 billion AEGIS)
pub const AEGIS_INITIAL_MINT: u64 = 1_000_000_000 * 10u64.pow(AEGIS_DECIMALS as u32);

/// Weekly AEGIS emission amount (100 million AEGIS)
pub const AEGIS_WEEKLY_EMISSION: u64 = 100_000_000 * 10u64.pow(AEGIS_DECIMALS as u32);

/// Week duration in seconds
pub const WEEK_IN_SECONDS: i64 = 7 * 24 * 60 * 60;

/// Day duration in seconds
pub const DAY_IN_SECONDS: i64 = 24 * 60 * 60;

/// Maximum number of allowed programs per policy
pub const MAX_ALLOWED_PROGRAMS: usize = 10;

/// Maximum description length
pub const MAX_DESCRIPTION_LEN: usize = 200;

/// Default maximum staleness for oracle prices (5 minutes)
pub const DEFAULT_MAX_STALENESS_SECONDS: i64 = 5 * 60;

/// Oracle slippage basis points (0.5%)
pub const ORACLE_SLIPPAGE_BPS: u16 = 50;

/// Pyth program ID
pub const PYTH_PROGRAM_ID: &str = "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2ep";

/// Emission admin public key
pub const EMISSION_ADMIN: &str = "EQ5c3ZTo33GFpB2JjCqga3ecnbv9cbRpGqnSYu4Dmyof";

/// Pool PDA seed
pub const POOL_SEED: &[u8] = b"pool";