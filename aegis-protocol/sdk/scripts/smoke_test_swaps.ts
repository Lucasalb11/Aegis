#!/usr/bin/env ts-node
/**
 * Smoke Test Swaps Script
 * 
 * Executes a limited number of swap transactions to verify pool functionality.
 * Uses wallets from the seed script and performs small swaps.
 * 
 * Usage: npm run smoke:devnet
 * 
 * Environment variables (from .env.local):
 * - SOLANA_RPC_URL
 * - AEGIS_PROGRAM_ID
 * - COMMITMENT
 * - WALLETS_DIR
 * - POOLS_CONFIG_PATH
 * - MAX_SMOKE_SWAPS_TOTAL
 * - MAX_SMOKE_SWAPS_PER_WALLET
 * - MAX_SLIPPAGE_BPS
 * - RUN_SMOKE_TEST (should be true)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  getMint,
} from '@solana/spl-token';
import BN from 'bn.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Aegis } from '../src/aegis';
import { Pool } from '../src/pool';

// Load environment variables
// Try SDK directory first, then project root
const envPath = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../.env.local'),
].find(p => fs.existsSync(p)) || path.join(__dirname, '../.env.local');

dotenv.config({ path: envPath });

interface PoolConfig {
  mintA: string;
  mintB: string;
  poolAddress: string;
  vaultA: string;
  vaultB: string;
  lpMint: string;
  feeBps: number;
  decimalsA: number;
  decimalsB: number;
}

interface PoolsConfig {
  pools: PoolConfig[];
}

interface SwapResult {
  walletIndex: number;
  walletPubkey: string;
  poolAddress: string;
  fromMint: string;
  toMint: string;
  amountIn: string;
  amountOut: string;
  signature: string;
  timestamp: number;
}

interface SmokeTestOutput {
  swaps: SwapResult[];
  summary: {
    totalSwaps: number;
    successfulSwaps: number;
    failedSwaps: number;
    walletsUsed: number;
    createdAt: number;
  };
}

// Simple Wallet implementation
class KeypairWallet {
  constructor(public keypair: Keypair) {}

  get publicKey() {
    return this.keypair.publicKey;
  }

  async signTransaction(tx: any) {
    tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions(txs: any[]) {
    return txs.map((tx) => {
      tx.partialSign(this.keypair);
      return tx;
    });
  }
}

// Configuration from environment
const config = {
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  programId: new PublicKey(process.env.AEGIS_PROGRAM_ID || 'FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9'),
  commitment: (process.env.COMMITMENT || 'confirmed') as 'confirmed' | 'finalized' | 'processed',
  walletsDir: process.env.WALLETS_DIR || path.join(__dirname, '../../local/wallets'),
  poolsConfigPath: process.env.POOLS_CONFIG_PATH || path.join(__dirname, '../config/devnet.pools.json'),
  maxSwapsTotal: parseInt(process.env.MAX_SMOKE_SWAPS_TOTAL || '30'),
  maxSwapsPerWallet: parseInt(process.env.MAX_SMOKE_SWAPS_PER_WALLET || '1'),
  maxSlippageBps: parseInt(process.env.MAX_SLIPPAGE_BPS || '100'), // 1%
  outputPath: path.join(__dirname, '../config/devnet.smoke.signatures.json'),
};

// Statistics
const stats = {
  totalSwaps: 0,
  successfulSwaps: 0,
  failedSwaps: 0,
  walletsUsed: new Set<number>(),
  swaps: [] as SwapResult[],
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = randomInt(min, max);
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function loadKeypair(filePath: string): Promise<Keypair> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Keypair file not found: ${filePath}`);
  }
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function loadWallets(): Promise<Keypair[]> {
  const wallets: Keypair[] = [];
  
  if (!fs.existsSync(config.walletsDir)) {
    throw new Error(`Wallets directory not found: ${config.walletsDir}. Run seed script first.`);
  }

  const files = fs.readdirSync(config.walletsDir)
    .filter(f => f.startsWith('wallet-') && f.endsWith('.json'))
    .sort();
  
  for (const file of files.slice(0, 50)) {
    const walletPath = path.join(config.walletsDir, file);
    try {
      const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      wallets.push(Keypair.fromSecretKey(new Uint8Array(secret)));
    } catch (error) {
      console.warn(`⚠️  Failed to load wallet ${file}:`, error);
    }
  }
  
  return wallets;
}

async function loadPoolsConfig(): Promise<PoolsConfig> {
  if (!fs.existsSync(config.poolsConfigPath)) {
    throw new Error(`Pools config not found: ${config.poolsConfigPath}. Run seed script first.`);
  }
  return JSON.parse(fs.readFileSync(config.poolsConfigPath, 'utf8'));
}

async function getWalletTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey
): Promise<BN> {
  try {
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const account = await getAccount(connection, ata);
    return account.amount;
  } catch {
    return new BN(0);
  }
}

async function ensureATAs(
  connection: Connection,
  wallet: Keypair,
  mintA: PublicKey,
  mintB: PublicKey
): Promise<{ ataA: PublicKey; ataB: PublicKey }> {
  const ataA = await getAssociatedTokenAddress(mintA, wallet.publicKey);
  const ataB = await getAssociatedTokenAddress(mintB, wallet.publicKey);

  // Check if ATAs exist
  try {
    await getAccount(connection, ataA);
  } catch {
    throw new Error(`Token account for ${mintA.toString()} does not exist. Wallet needs to be funded first.`);
  }

  try {
    await getAccount(connection, ataB);
  } catch {
    throw new Error(`Token account for ${mintB.toString()} does not exist. Wallet needs to be funded first.`);
  }

  return { ataA, ataB };
}

/**
 * Calculate swap output using the same formula as the on-chain program
 * Formula: amount_out = reserve_out - (reserve_in * reserve_out) / (reserve_in + amount_in_after_fee)
 */
function computeSwapOut(
  amountIn: BN,
  reserveIn: BN,
  reserveOut: BN,
  feeBps: number
): BN {
  const BPS_DENOMINATOR = 10000;
  
  // Calculate amount in after fee
  const amountInAfterFee = amountIn
    .muln(BPS_DENOMINATOR - feeBps)
    .divn(BPS_DENOMINATOR);
  
  // Calculate new reserve in
  const newReserveIn = reserveIn.add(amountInAfterFee);
  
  // Calculate constant product k
  const k = reserveIn.mul(reserveOut);
  
  // Calculate new reserve out
  const newReserveOut = k.div(newReserveIn);
  
  // Calculate amount out
  const amountOut = reserveOut.sub(newReserveOut);
  
  return amountOut;
}

async function calculateMinAmountOut(
  connection: Connection,
  pool: Pool,
  amountIn: BN,
  aToB: boolean,
  slippageBps: number
): Promise<BN> {
  try {
    // Get current reserves
    const vaultAAccount = await getAccount(connection, pool.info.vaultA);
    const vaultBAccount = await getAccount(connection, pool.info.vaultB);
    
    const reserveIn = aToB ? vaultAAccount.amount : vaultBAccount.amount;
    const reserveOut = aToB ? vaultBAccount.amount : vaultAAccount.amount;
    
    // Calculate expected output
    const expectedOut = computeSwapOut(amountIn, reserveIn, reserveOut, pool.info.feeBps);
    
    // Apply slippage tolerance
    const slippageMultiplier = (10000 - slippageBps) / 10000;
    const minAmountOut = expectedOut.muln(Math.floor(slippageMultiplier * 10000)).divn(10000);
    
    return minAmountOut;
  } catch (error) {
    // Fallback: simple calculation if we can't get reserves
    console.warn('Could not fetch reserves, using simple calculation');
    const slippageMultiplier = (10000 - slippageBps) / 10000;
    return amountIn.muln(Math.floor(slippageMultiplier * 10000)).divn(10000);
  }
}

async function executeSwap(
  connection: Connection,
  aegis: Aegis,
  pool: Pool,
  wallet: Keypair,
  fromMint: PublicKey,
  toMint: PublicKey,
  amountIn: BN,
  decimalsIn: number,
  decimalsOut: number
): Promise<string> {
  const walletWrapper = new KeypairWallet(wallet);
  const aegisWithWallet = new Aegis(connection, walletWrapper, { programId: config.programId });

  const { ataA, ataB } = await ensureATAs(connection, wallet, pool.info.mintA, pool.info.mintB);

  const userSourceToken = fromMint.equals(pool.info.mintA) ? ataA : ataB;
  const userDestinationToken = toMint.equals(pool.info.mintA) ? ataA : ataB;

  const aToB = fromMint.equals(pool.info.mintA);

  // Calculate min amount out with slippage based on actual pool reserves
  const minAmountOut = await calculateMinAmountOut(
    connection,
    pool,
    amountIn,
    aToB,
    config.maxSlippageBps
  );

  // Create pool instance with the correct wallet
  const poolWithWallet = new Pool(aegisWithWallet, pool.info);

  const signature = await poolWithWallet.swap(
    {
      amountIn,
      minAmountOut,
      aToB,
    },
    userSourceToken,
    userDestinationToken
  );

  return signature;
}

async function main() {
  console.log('\n💨 Aegis Protocol - Smoke Test Swaps\n');
  console.log('='.repeat(60));

  // Initialize connection
  const connection = new Connection(config.rpcUrl, config.commitment);
  console.log(`🔗 RPC: ${config.rpcUrl}`);
  console.log(`📦 Program ID: ${config.programId.toString()}\n`);

  // Load pools config
  console.log('📋 Loading pools configuration...');
  const poolsConfig = await loadPoolsConfig();
  console.log(`✅ Loaded ${poolsConfig.pools.length} pools\n`);

  if (poolsConfig.pools.length === 0) {
    throw new Error('No pools found. Run seed script first.');
  }

  // Load wallets
  console.log('👛 Loading wallets...');
  const wallets = await loadWallets();
  console.log(`✅ Loaded ${wallets.length} wallets\n`);

  if (wallets.length === 0) {
    throw new Error('No wallets found. Run seed script first.');
  }

  // Initialize Aegis (dummy wallet, will use individual wallets for swaps)
  const dummyWallet = new KeypairWallet(wallets[0]);
  const aegis = new Aegis(connection, dummyWallet, { programId: config.programId });

  // Get all pools
  const pools = await aegis.getPools();
  console.log(`🏊 Found ${pools.length} pools on-chain\n`);

  if (pools.length === 0) {
    throw new Error('No pools found on-chain.');
  }

  // Execute swaps
  console.log('🔄 Executing smoke test swaps...\n');
  console.log(`   Max swaps total: ${config.maxSwapsTotal}`);
  console.log(`   Max swaps per wallet: ${config.maxSwapsPerWallet}\n`);

  const shuffledWallets = [...wallets].sort(() => Math.random() - 0.5);
  const shuffledPools = [...pools].sort(() => Math.random() - 0.5);

  let swapsExecuted = 0;
  const swapsPerWallet = new Map<number, number>();

  for (const wallet of shuffledWallets) {
    if (swapsExecuted >= config.maxSwapsTotal) {
      break;
    }

    const walletIndex = wallets.indexOf(wallet);
    const currentSwaps = swapsPerWallet.get(walletIndex) || 0;

    if (currentSwaps >= config.maxSwapsPerWallet) {
      continue;
    }

    // Find a pool where wallet has tokens
    let swapExecuted = false;
    for (const pool of shuffledPools) {
      if (swapsExecuted >= config.maxSwapsTotal) {
        break;
      }

      try {
        // Check balances
        const balanceA = await getWalletTokenBalance(connection, wallet.publicKey, pool.info.mintA);
        const balanceB = await getWalletTokenBalance(connection, wallet.publicKey, pool.info.mintB);

        // Determine swap direction (prefer A->B if balanceA > 0)
        let fromMint: PublicKey;
        let toMint: PublicKey;
        let amountIn: BN;
        let decimalsIn: number;
        let decimalsOut: number;

        if (balanceA.gt(new BN(0))) {
          fromMint = pool.info.mintA;
          toMint = pool.info.mintB;
          // Use 10% of balance or minimum 1000 units
          amountIn = BN.max(balanceA.divn(10), new BN(1000));
          const poolConfig = poolsConfig.pools.find(p => p.poolAddress === pool.info.address.toString());
          decimalsIn = poolConfig?.decimalsA || 6;
          decimalsOut = poolConfig?.decimalsB || 6;
        } else if (balanceB.gt(new BN(0))) {
          fromMint = pool.info.mintB;
          toMint = pool.info.mintA;
          amountIn = BN.max(balanceB.divn(10), new BN(1000));
          const poolConfig = poolsConfig.pools.find(p => p.poolAddress === pool.info.address.toString());
          decimalsIn = poolConfig?.decimalsB || 6;
          decimalsOut = poolConfig?.decimalsA || 6;
        } else {
          continue; // Wallet has no tokens for this pool
        }

        // Execute swap
        console.log(`  Wallet ${walletIndex + 1}: Swapping ${amountIn.toString()} from ${fromMint.toString().slice(0, 8)}... to ${toMint.toString().slice(0, 8)}...`);
        
        // Get balances before swap
        const balanceABefore = await getWalletTokenBalance(connection, wallet.publicKey, pool.info.mintA);
        const balanceBBefore = await getWalletTokenBalance(connection, wallet.publicKey, pool.info.mintB);
        
        const signature = await executeSwap(
          connection,
          aegis,
          pool,
          wallet,
          fromMint,
          toMint,
          amountIn,
          decimalsIn,
          decimalsOut
        );

        // Get balances after swap
        const balanceAAfter = await getWalletTokenBalance(connection, wallet.publicKey, pool.info.mintA);
        const balanceBAfter = await getWalletTokenBalance(connection, wallet.publicKey, pool.info.mintB);
        
        // Calculate actual amount out
        const amountOut = fromMint.equals(pool.info.mintA)
          ? balanceBAfter.sub(balanceBBefore)
          : balanceAAfter.sub(balanceABefore);

        const swapResult: SwapResult = {
          walletIndex,
          walletPubkey: wallet.publicKey.toString(),
          poolAddress: pool.info.address.toString(),
          fromMint: fromMint.toString(),
          toMint: toMint.toString(),
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          signature,
          timestamp: Date.now(),
        };

        stats.swaps.push(swapResult);
        stats.totalSwaps++;
        stats.successfulSwaps++;
        stats.walletsUsed.add(walletIndex);
        swapsPerWallet.set(walletIndex, currentSwaps + 1);
        swapsExecuted++;
        swapExecuted = true;

        console.log(`    ✅ Swap successful: ${signature}`);
        console.log(`       Amount out: ${amountOut.toString()}`);
        console.log(`       Balances: A=${balanceAAfter.toString()}, B=${balanceBAfter.toString()}`);

        // Random delay to avoid rate limiting
        await randomDelay(200, 800);
        break;
      } catch (error: any) {
        console.error(`    ❌ Swap failed: ${error.message}`);
        stats.totalSwaps++;
        stats.failedSwaps++;
        // Continue to next pool
      }
    }

    if (!swapExecuted) {
      console.log(`  Wallet ${walletIndex + 1}: No suitable pool found (insufficient balances)`);
    }
  }

  // Save results
  const output: SmokeTestOutput = {
    swaps: stats.swaps,
    summary: {
      totalSwaps: stats.totalSwaps,
      successfulSwaps: stats.successfulSwaps,
      failedSwaps: stats.failedSwaps,
      walletsUsed: stats.walletsUsed.size,
      createdAt: Date.now(),
    },
  };

  const outputDir = path.dirname(config.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(config.outputPath, JSON.stringify(output, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SMOKE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total swaps attempted:  ${stats.totalSwaps}`);
  console.log(`Successful swaps:        ${stats.successfulSwaps}`);
  console.log(`Failed swaps:            ${stats.failedSwaps}`);
  console.log(`Wallets used:            ${stats.walletsUsed.size}`);
  console.log(`\n💾 Results saved to: ${config.outputPath}`);
  console.log('='.repeat(60) + '\n');

  if (stats.failedSwaps > 0) {
    console.warn('⚠️  Some swaps failed. Check the output file for details.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}
