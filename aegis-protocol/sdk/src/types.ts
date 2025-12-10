import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Re-export types from main index
export interface PolicyConfig {
  dailySpendLimitLamports: BN;
  largeTxThresholdLamports: BN;
  allowedPrograms?: PublicKey[];
}

export interface SwapRequestParams {
  vaultPubkey: PublicKey;
  amount: BN;
  fromMint: PublicKey;
  toMint: PublicKey;
  amountOutMin: BN;
  jupiterIx?: TransactionInstruction;
  jupiterMetas?: AccountMeta[];
  jupiterAccounts?: Buffer;
  jupiterData?: Buffer;
}

export interface AegisClientConfig {
  connection: any;
  wallet: any;
  programId: PublicKey;
}

// Additional types for responses
export interface VaultInfo {
  owner: PublicKey;
  authority: PublicKey;
  balance: BN;
  dailySpent: BN;
  lastResetTimestamp: BN;
  policy: PublicKey;
  bump: number;
  pendingActionsCount: number;
  isActive: boolean;
}

export interface PolicyInfo {
  vault: PublicKey;
  dailySpendLimitLamports: BN;
  largeTxThresholdLamports: BN;
  allowedPrograms: PublicKey[];
  allowedProgramsCount: number;
  bump: number;
  isActive: boolean;
  largeTxCooldownSeconds: number;
}

export interface PendingActionInfo {
  vault: PublicKey;
  actionType: ActionType;
  amountLamports: BN;
  targetProgram: PublicKey;
  targetAccount: PublicKey;
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  description: string;
  requester: PublicKey;
  requestedAt: BN;
  expiresAt: BN;
  status: ActionStatus;
  approver?: PublicKey;
  processedAt?: BN;
  bump: number;
  jupiterAccounts: Buffer;
  jupiterIxData: Buffer;
}

export enum ActionType {
  LargeTransfer = 0,
  Swap = 1,
  LendingDeposit = 2,
  LendingWithdraw = 3,
  Stake = 4,
  Unstake = 5,
  Custom = 6,
}

export enum ActionStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Expired = 3,
  Failed = 4,
}

// Error types
export class AegisError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AegisError';
  }
}

// Constants
export const DEFAULT_PROGRAM_ID = new PublicKey('Aegis111111111111111111111111111111111111111');
export const JUPITER_PROGRAM_ID = new PublicKey('JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4');
export const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const MAX_JUPITER_ACCOUNTS_LEN = 1024;
export const MAX_JUPITER_IX_DATA_LEN = 512;

// Utility functions
export function lamportsToSol(lamports: BN): number {
  return lamports.toNumber() / 1_000_000_000;
}

export function solToLamports(sol: number): BN {
  return new BN(sol * 1_000_000_000);
}
