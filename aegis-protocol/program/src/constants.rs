/// Maximum fee in basis points (100% = 10000)
pub const MAX_FEE_BPS: u16 = 10000;

/// Denominator for basis points calculations
pub const BPS_DENOMINATOR: u64 = 10000;

/// Minimum liquidity to prevent division by zero
pub const MIN_LIQUIDITY: u64 = 1000;

/// AEGIS token decimals (matches SPL mint)
pub const AEGIS_DECIMALS: u8 = 9;

/// Planned total supply (lamports = tokens * 10^decimals) - kept as u128
pub const AEGIS_TOTAL_SUPPLY_LAMPORTS: u128 =
    260_000_000_000u128 * 10u128.pow(AEGIS_DECIMALS as u32);

/// Weekly emission amount (1B AEGIS) fits in u64
pub const AEGIS_WEEKLY_EMISSION: u64 = 1_000_000_000 * 10u64.pow(AEGIS_DECIMALS as u32);

/// Number of weeks planned for emissions (5 years)
pub const AEGIS_DISTRIBUTION_WEEKS: u32 = 260;

/// Emission split percentages in basis points
pub const LM_PERCENT_BPS: u64 = 6000; // 60%
pub const TEAM_PERCENT_BPS: u64 = 3000; // 30%
pub const ECOSYSTEM_PERCENT_BPS: u64 = 1000; // 10%

/// Reward points accrue from 0.05% of swap volume (5 bps)
pub const REWARD_POINTS_FEE_BPS: u64 = 5;

/// Minimum liquidity (lamports) required for boosted rewards (10 SOL)
pub const MIN_LIQ_FOR_REWARDS: u64 = 10_000_000_000;

/// Smallest reward points threshold to allow claims
pub const MIN_REWARD_POINTS: u128 = 1;

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