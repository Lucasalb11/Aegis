use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Daily spend limit must be greater than zero")]
    InvalidDailyLimit,
    #[msg("Large transaction threshold must be greater than zero")]
    InvalidThreshold,
    #[msg("Large transaction threshold cannot exceed daily limit")]
    ThresholdExceedsDailyLimit,
    #[msg("Too many allowed programs")]
    TooManyAllowedPrograms,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Transaction amount is below the large transaction threshold")]
    TransactionBelowThreshold,
    #[msg("Transaction amount is below the large transaction threshold")]
    BelowThreshold,
    #[msg("Target program is not in the allowed programs list")]
    ProgramNotAllowed,
    #[msg("Daily spending limit exceeded")]
    DailyLimitExceeded,
    #[msg("Action is not in pending status")]
    ActionNotPending,
    #[msg("Action has expired")]
    ActionExpired,
    #[msg("Vault owner mismatch")]
    VaultOwnerMismatch,
    #[msg("Vault is not active")]
    VaultNotActive,
    #[msg("Policy is not active")]
    PolicyNotActive,
    #[msg("Insufficient balance in vault")]
    InsufficientBalance,
    #[msg("Token account does not belong to vault")]
    InvalidTokenAccount,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    #[msg("Slippage exceeded minimum output")]
    SlippageExceeded,
    #[msg("Cooldown for large transaction has not elapsed")]
    CooldownNotElapsed,
    #[msg("Exceeded maximum pending actions")]
    PendingActionsExhausted,
    #[msg("Pending actions count underflowed")]
    PendingActionsUnderflow,
    #[msg("Pending action account is required for large transaction")]
    PendingActionMissing,
    #[msg("Pending action account should not be provided for small transaction")]
    UnexpectedPendingAction,
    #[msg("Action is not yet expired")]
    ActionNotExpired,
    #[msg("Mint order must be mint_a < mint_b")]
    MintOrderInvalid,
    #[msg("Pool fee exceeds maximum allowed")]
    InvalidFee,
    #[msg("Liquidity minted is zero")]
    ZeroLiquidityMinted,
    #[msg("Insufficient liquidity available")]
    InsufficientLiquidity,
    #[msg("Vault account does not match pool configuration")]
    InvalidVault,
    #[msg("LP mint does not match pool authority")]
    InvalidLpMint,
    #[msg("Calculated amount out is zero")]
    ZeroAmountOut,
    #[msg("Oracle price is invalid")]
    OraclePriceInvalid,
    #[msg("Oracle not configured for this operation")]
    OracleNotConfigured,
    #[msg("Invalid token program provided")]
    InvalidTokenProgram,
}