import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export interface PoolInfo {
  address: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  vaultA: PublicKey;
  vaultB: PublicKey;
  lpMint: PublicKey;
  feeBps: number;
  lpSupply: BN;
  creator: PublicKey;
}

export interface LiquidityParams {
  amountA: BN;
  amountB: BN;
}

export interface SwapParams {
  amountIn: BN;
  minAmountOut: BN;
  aToB: boolean;
}

export interface AddLiquidityResult {
  pool: PublicKey;
  lpTokens: BN;
  amountAUsed: BN;
  amountBUsed: BN;
}

export interface SwapResult {
  amountOut: BN;
  fee: BN;
}

export interface RemoveLiquidityParams {
  lpAmount: BN;
}

export interface RemoveLiquidityResult {
  pool: PublicKey;
  lpBurned: BN;
  amountAReceived: BN;
  amountBReceived: BN;
}

export interface AegisConfig {
  programId: PublicKey;
  cluster: 'devnet' | 'mainnet-beta' | 'testnet';
}