use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Insufficient balance")]
    InsufficientBalance,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Mint order invalid")]
    MintOrderInvalid,

    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,

    #[msg("Invalid fee")]
    InvalidFee,

    #[msg("Zero amount out")]
    ZeroAmountOut,

    #[msg("Invalid vault")]
    InvalidVault,

    #[msg("Invalid LP mint")]
    InvalidLpMint,

    #[msg("Zero liquidity minted")]
    ZeroLiquidityMinted,

    #[msg("Slippage exceeded")]
    SlippageExceeded,

    #[msg("Cooldown not elapsed")]
    CooldownNotElapsed,

    #[msg("Already initialized")]
    AlreadyInitialized,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Vault not active")]
    VaultNotActive,

    #[msg("Vault owner mismatch")]
    VaultOwnerMismatch,

    #[msg("Policy not active")]
    PolicyNotActive,

    #[msg("Threshold exceeds daily limit")]
    ThresholdExceedsDailyLimit,

    #[msg("Too many allowed programs")]
    TooManyAllowedPrograms,

    #[msg("Description too long")]
    DescriptionTooLong,

    #[msg("Oracle not configured")]
    OracleNotConfigured,

    #[msg("Oracle price invalid")]
    OraclePriceInvalid,

    #[msg("Program not allowed")]
    ProgramNotAllowed,

    #[msg("Daily limit exceeded")]
    DailyLimitExceeded,

    #[msg("Action not pending")]
    ActionNotPending,

    #[msg("Action expired")]
    ActionExpired,

    #[msg("Below threshold")]
    BelowThreshold,

    #[msg("Total supply exceeds SPL token limit")]
    SupplyTooLarge,

    #[msg("Emission schedule already completed")]
    EmissionCompleted,

    #[msg("Destination token account mint mismatch")]
    InvalidDestinationMint,

    #[msg("Invalid mint authority")]
    InvalidMintAuthority,

    #[msg("No reward points available for claim")]
    NoRewardPoints,

    #[msg("Pool not eligible for boosted rewards")]
    PoolNotEligible,

    #[msg("Not enough tokens in emission vault")]
    EmissionInsufficientBalance,

    #[msg("Reentrancy detected")]
    ReentrancyDetected,
}