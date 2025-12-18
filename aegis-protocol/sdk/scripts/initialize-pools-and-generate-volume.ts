#!/usr/bin/env ts-node
/**
 * Aegis Protocol - Pool Initialization and Volume Generation Script
 * 
 * This script:
 * 1. Loads 50 wallets from a file or generates them
 * 2. Creates AMM pools for token pairs
 * 3. Adds distributed liquidity using all wallets
 * 4. Generates trading volume through random swaps
 * 
 * Usage:
 *   ts-node initialize-pools-and-generate-volume.ts --pools=5 --swaps=20 --wallets=50
 * 
 * Environment Variables:
 *   AEGIS_RPC_ENDPOINT - RPC endpoint (default: https://api.devnet.solana.com)
 *   AEGIS_PROGRAM_ID - Program ID (default: from env.local or AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu)
 *   WALLETS_FILE - Path to wallets JSON file (default: ./wallets.json)
 * 
 * Security Warning:
 *   ⚠️  NEVER commit wallet private keys to version control!
 *   ⚠️  This script is for DEVNET ONLY - do not use on mainnet!
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  getMint,
  createMint,
  mintTo,
  transfer,
} from '@solana/spl-token';
import BN from 'bn.js';
import * as fs from 'fs';
import * as path from 'path';
import { Aegis, Wallet } from '../src/aegis';
import { Pool } from '../src/pool';

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.AEGIS_RPC_ENDPOINT || 'https://api.devnet.solana.com';
const DEFAULT_PROGRAM_ID = 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu';
const PROGRAM_ID = process.env.AEGIS_PROGRAM_ID || DEFAULT_PROGRAM_ID;
const WALLETS_FILE = process.env.WALLETS_FILE || path.join(__dirname, '../../.secrets/devnet/wallets.json');

// Default token mints (Aegis Protocol tokens from devnet)
const DEFAULT_TOKEN_MINTS = [
  'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9', // AEGIS
  'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3', // AERO
  '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc', // ABTC
  'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys', // AUSD
  '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15', // ASOL
  'So1111111111111111111111111111111112', // Wrapped SOL
];

// Configuration defaults
const DEFAULT_POOLS_TO_CREATE = 5;
const DEFAULT_SWAPS_PER_POOL = 20;
const DEFAULT_WALLETS_COUNT = 50;
const DEFAULT_LIQUIDITY_PER_WALLET = 100; // Base units (will be multiplied by decimals)
const DEFAULT_SWAP_AMOUNT_MIN = 10; // Base units
const DEFAULT_SWAP_AMOUNT_MAX = 100; // Base units
const DEFAULT_FEE_BPS = 30; // 0.3%

// ============================================================================
// Types
// ============================================================================

interface WalletInfo {
  publicKey: string;
  privateKey: string; // Base64 encoded secret key
  balance?: number;
}

interface TokenPair {
  mintA: PublicKey;
  mintB: PublicKey;
  symbolA: string;
  symbolB: string;
  decimalsA: number;
  decimalsB: number;
}

interface PoolCreationResult {
  pool: Pool;
  pair: TokenPair;
  created: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args: Record<string, string | number> = {};
  
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.replace('--', '').split('=');
    if (key && value) {
      args[key] = isNaN(Number(value)) ? value : Number(value);
    }
  });
  
  return {
    pools: (args.pools as number) || DEFAULT_POOLS_TO_CREATE,
    swaps: (args.swaps as number) || DEFAULT_SWAPS_PER_POOL,
    wallets: (args.wallets as number) || DEFAULT_WALLETS_COUNT,
    liquidity: (args.liquidity as number) || DEFAULT_LIQUIDITY_PER_WALLET,
    minSwap: (args.minSwap as number) || DEFAULT_SWAP_AMOUNT_MIN,
    maxSwap: (args.maxSwap as number) || DEFAULT_SWAP_AMOUNT_MAX,
  };
}

/**
 * Load wallets from file or generate new ones
 */
function loadWallets(count: number): WalletInfo[] {
  let wallets: WalletInfo[] = [];
  
  // Try to load from file
  if (fs.existsSync(WALLETS_FILE)) {
    try {
      const fileContent = fs.readFileSync(WALLETS_FILE, 'utf-8');
      wallets = JSON.parse(fileContent);
      console.log(`✅ Loaded ${wallets.length} wallets from ${WALLETS_FILE}`);
    } catch (error) {
      console.warn(`⚠️  Failed to load wallets from file: ${error}`);
    }
  }
  
  // Generate additional wallets if needed
  while (wallets.length < count) {
    const wallet = Keypair.generate();
    wallets.push({
      publicKey: wallet.publicKey.toString(),
      privateKey: Buffer.from(wallet.secretKey).toString('base64'),
    });
  }
  
  // Save wallets to file
  try {
    const dir = path.dirname(WALLETS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
    console.log(`💾 Saved ${wallets.length} wallets to ${WALLETS_FILE}`);
    console.log(`⚠️  SECURITY WARNING: Keep this file secure and never commit it to git!`);
  } catch (error) {
    console.warn(`⚠️  Failed to save wallets: ${error}`);
  }
  
  return wallets.slice(0, count);
}

/**
 * Convert WalletInfo to Keypair
 */
function walletToKeypair(wallet: WalletInfo): Keypair {
  const secretKey = Buffer.from(wallet.privateKey, 'base64');
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Create Anchor-compatible Wallet from Keypair
 */
function createWallet(keypair: Keypair, connection: Connection): Wallet {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.sign(keypair);
      return tx;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      txs.forEach(tx => tx.sign(keypair));
      return txs;
    },
  };
}

/**
 * Ensure wallet has minimum SOL balance
 */
async function ensureBalance(
  connection: Connection,
  keypair: Keypair,
  minSol: number
): Promise<void> {
  const balance = await connection.getBalance(keypair.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  
  if (balanceSol < minSol) {
    console.log(`  💸 Requesting airdrop for ${keypair.publicKey.toString().slice(0, 8)}...`);
    try {
      const airdropSig = await connection.requestAirdrop(
        keypair.publicKey,
        minSol * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSig, 'confirmed');
      console.log(`  ✅ Airdrop confirmed`);
    } catch (error: any) {
      if (error.message?.includes('429')) {
        console.log(`  ⏳ Rate limited, waiting 30s...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        return ensureBalance(connection, keypair, minSol);
      }
      throw error;
    }
  }
}

/**
 * Get token metadata (symbol, decimals)
 */
async function getTokenMetadata(
  connection: Connection,
  mint: PublicKey
): Promise<{ symbol: string; decimals: number }> {
  try {
    const mintInfo = await getMint(connection, mint);
    const mintStr = mint.toString();
    
    // Known tokens mapping
    const knownTokens: Record<string, string> = {
      'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9': 'AEGIS',
      'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3': 'AERO',
      '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc': 'ABTC',
      'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys': 'AUSD',
      '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15': 'ASOL',
      'So1111111111111111111111111111111112': 'SOL',
    };
    
    return {
      symbol: knownTokens[mintStr] || mintStr.slice(0, 4).toUpperCase(),
      decimals: mintInfo.decimals,
    };
  } catch (error) {
    console.warn(`Failed to get metadata for ${mint.toString()}:`, error);
    return { symbol: 'UNK', decimals: 6 };
  }
}

/**
 * Generate token pairs from mint list
 */
function generateTokenPairs(mints: PublicKey[]): TokenPair[] {
  const pairs: TokenPair[] = [];
  
  for (let i = 0; i < mints.length; i++) {
    for (let j = i + 1; j < mints.length; j++) {
      const mintA = mints[i];
      const mintB = mints[j];
      
      // Ensure mintA < mintB for consistent ordering
      const [token0, token1] = mintA.toBuffer().compare(mintB.toBuffer()) < 0
        ? [mintA, mintB]
        : [mintB, mintA];
      
      pairs.push({
        mintA: token0,
        mintB: token1,
        symbolA: '', // Will be filled later
        symbolB: '', // Will be filled later
        decimalsA: 6, // Will be filled later
        decimalsB: 6, // Will be filled later
      });
    }
  }
  
  return pairs;
}

/**
 * Retry wrapper for async operations
 */
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (i < maxRetries - 1) {
        console.log(`  ⚠️  Retry ${i + 1}/${maxRetries}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * Random delay between min and max milliseconds
 */
function randomDelay(min: number = 1000, max: number = 5000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Create pools for token pairs
 */
async function createPools(
  connection: Connection,
  programId: PublicKey,
  pairs: TokenPair[],
  count: number,
  creatorWallet: Wallet,
  creatorKeypair: Keypair
): Promise<PoolCreationResult[]> {
  console.log(`\n🏊 Creating ${count} pools...`);
  console.log(`================================`);
  
  const aegis = new Aegis(connection, creatorWallet, { programId });
  const results: PoolCreationResult[] = [];
  const pairsToCreate = pairs.slice(0, count);
  
  for (let i = 0; i < pairsToCreate.length; i++) {
    const pair = pairsToCreate[i];
    
    try {
      console.log(`\n[${i + 1}/${pairsToCreate.length}] Creating pool: ${pair.symbolA}/${pair.symbolB}`);
      
      // Get or create pool
      const pool = await retry(async () => {
        return await aegis.getOrCreatePool(pair.mintA, pair.mintB, DEFAULT_FEE_BPS);
      });
      
      // Check if pool was just created
      const poolAccount = await connection.getAccountInfo(pool.info.address);
      const created = poolAccount !== null;
      
      results.push({ pool, pair, created });
      
      console.log(`  ✅ Pool address: ${pool.info.address.toString()}`);
      console.log(`  📊 Fee: ${pool.info.feeBps / 100}%`);
      
      // Small delay between pool creations
      await randomDelay(500, 1500);
    } catch (error: any) {
      console.error(`  ❌ Failed to create pool: ${error.message}`);
      // Continue with next pool
    }
  }
  
  return results;
}

/**
 * Add liquidity to pools using distributed wallets
 */
async function addLiquidityToPools(
  connection: Connection,
  programId: PublicKey,
  pools: PoolCreationResult[],
  wallets: WalletInfo[],
  liquidityAmount: number
): Promise<void> {
  console.log(`\n💧 Adding liquidity to pools...`);
  console.log(`================================`);
  
  for (const poolResult of pools) {
    const { pool, pair } = poolResult;
    
    console.log(`\n📊 Pool: ${pair.symbolA}/${pair.symbolB}`);
    
    // Distribute wallets across this pool
    const walletsPerPool = Math.max(1, Math.floor(wallets.length / pools.length));
    const poolWallets = wallets.slice(0, walletsPerPool);
    
    console.log(`  Using ${poolWallets.length} wallets for liquidity`);
    
    for (let i = 0; i < poolWallets.length; i++) {
      const walletInfo = poolWallets[i];
      const keypair = walletToKeypair(walletInfo);
      
      try {
        // Ensure wallet has SOL
        await ensureBalance(connection, keypair, 0.1);
        
        const wallet = createWallet(keypair, connection);
        const aegis = new Aegis(connection, wallet, { programId });
        
        // Get token accounts
        const [userTokenA, userTokenB, userLpToken] = await Promise.all([
          getOrCreateAssociatedTokenAccount(connection, keypair, pair.mintA, keypair.publicKey),
          getOrCreateAssociatedTokenAccount(connection, keypair, pair.mintB, keypair.publicKey),
          getOrCreateAssociatedTokenAccount(connection, keypair, pool.info.lpMint, keypair.publicKey),
        ]);
        
        // Calculate amounts with decimals
        const amountA = new BN(liquidityAmount * Math.pow(10, pair.decimalsA));
        const amountB = new BN(liquidityAmount * Math.pow(10, pair.decimalsB));
        
        // Check balances
        const [balanceA, balanceB] = await Promise.all([
          getAccount(connection, userTokenA.address).catch(() => null),
          getAccount(connection, userTokenB.address).catch(() => null),
        ]);
        
        // Mint tokens if needed (for test tokens)
        if (!balanceA || Number(balanceA.amount) < Number(amountA)) {
          try {
            await mintTo(
              connection,
              keypair,
              pair.mintA,
              userTokenA.address,
              keypair, // Using wallet as mint authority for test tokens
              Number(amountA) * 10 // Mint extra for swaps
            );
          } catch (error) {
            console.log(`  ⚠️  Cannot mint ${pair.symbolA}, skipping...`);
            continue;
          }
        }
        
        if (!balanceB || Number(balanceB.amount) < Number(amountB)) {
          try {
            await mintTo(
              connection,
              keypair,
              pair.mintB,
              userTokenB.address,
              keypair,
              Number(amountB) * 10
            );
          } catch (error) {
            console.log(`  ⚠️  Cannot mint ${pair.symbolB}, skipping...`);
            continue;
          }
        }
        
        // Add liquidity
        await retry(async () => {
          const result = await pool.pool.addLiquidity(
            {
              amountA,
              amountB,
            },
            userTokenA.address,
            userTokenB.address,
            userLpToken.address
          );
          
          // Log LP tokens received (if available)
          if (result.lpTokens && !result.lpTokens.isZero()) {
            console.log(`    💰 Received ${result.lpTokens.toString()} LP tokens`);
          }
        });
        
        console.log(`  ✅ Wallet ${i + 1}: Added liquidity`);
        
        // Random delay
        await randomDelay(500, 1500);
      } catch (error: any) {
        console.log(`  ⚠️  Wallet ${i + 1} failed: ${error.message}`);
        // Continue with next wallet
      }
    }
  }
}

/**
 * Generate trading volume through random swaps
 */
async function generateVolume(
  connection: Connection,
  programId: PublicKey,
  pools: PoolCreationResult[],
  wallets: WalletInfo[],
  swapsPerPool: number,
  minAmount: number,
  maxAmount: number
): Promise<void> {
  console.log(`\n🔄 Generating trading volume...`);
  console.log(`================================`);
  
  let totalSwaps = 0;
  let successfulSwaps = 0;
  
  for (const poolResult of pools) {
    const { pool, pair } = poolResult;
    
    console.log(`\n📊 Pool: ${pair.symbolA}/${pair.symbolB}`);
    console.log(`  Target: ${swapsPerPool} swaps`);
    
    let swapsDone = 0;
    
    for (let i = 0; i < swapsPerPool; i++) {
      // Pick random wallet
      const walletInfo = wallets[Math.floor(Math.random() * wallets.length)];
      const keypair = walletToKeypair(walletInfo);
      
      try {
        // Ensure wallet has SOL
        await ensureBalance(connection, keypair, 0.05);
        
        const wallet = createWallet(keypair, connection);
        const aegis = new Aegis(connection, wallet, { programId });
        
        // Random swap direction (A->B or B->A)
        const swapAtoB = Math.random() > 0.5;
        const fromMint = swapAtoB ? pair.mintA : pair.mintB;
        const toMint = swapAtoB ? pair.mintB : pair.mintA;
        const fromDecimals = swapAtoB ? pair.decimalsA : pair.decimalsB;
        
        // Random amount
        const amount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
        const amountIn = new BN(amount * Math.pow(10, fromDecimals));
        
        // Calculate min amount out with 5% slippage
        const minAmountOut = amountIn.mul(new BN(95)).div(new BN(100));
        
        // Get token accounts
        const [userSourceToken, userDestinationToken] = await Promise.all([
          getOrCreateAssociatedTokenAccount(connection, keypair, fromMint, keypair.publicKey),
          getOrCreateAssociatedTokenAccount(connection, keypair, toMint, keypair.publicKey),
        ]);
        
        // Check source balance
        try {
          const sourceBalance = await getAccount(connection, userSourceToken.address);
          if (Number(sourceBalance.amount) < Number(amountIn)) {
            // Try to mint if possible
            try {
              await mintTo(
                connection,
                keypair,
                fromMint,
                userSourceToken.address,
                keypair,
                Number(amountIn) * 2
              );
            } catch {
              console.log(`  ⚠️  Swap ${i + 1}: Insufficient balance, skipping...`);
              continue;
            }
          }
        } catch {
          // Account doesn't exist, try to mint
          try {
            await mintTo(
              connection,
              keypair,
              fromMint,
              userSourceToken.address,
              keypair,
              Number(amountIn) * 2
            );
          } catch {
            console.log(`  ⚠️  Swap ${i + 1}: Cannot create token account, skipping...`);
            continue;
          }
        }
        
        // Execute swap
        await retry(async () => {
          await aegis.swap({
            fromMint,
            toMint,
            amountIn,
            minAmountOut,
          });
        });
        
        swapsDone++;
        successfulSwaps++;
        totalSwaps++;
        
        if (swapsDone % 5 === 0) {
          console.log(`  ✅ Completed ${swapsDone}/${swapsPerPool} swaps`);
        }
        
        // Random delay between swaps
        await randomDelay(1000, 5000);
      } catch (error: any) {
        totalSwaps++;
        console.log(`  ⚠️  Swap ${i + 1} failed: ${error.message}`);
        // Continue with next swap
      }
    }
    
    console.log(`  ✅ Pool complete: ${swapsDone}/${swapsPerPool} successful swaps`);
  }
  
  console.log(`\n📈 Volume Generation Summary:`);
  console.log(`  Total swaps attempted: ${totalSwaps}`);
  console.log(`  Successful swaps: ${successfulSwaps}`);
  console.log(`  Success rate: ${((successfulSwaps / totalSwaps) * 100).toFixed(2)}%`);
}

/**
 * Monitor pool status
 */
async function monitorPools(
  connection: Connection,
  programId: PublicKey,
  pools: PoolCreationResult[]
): Promise<void> {
  console.log(`\n📊 Pool Status:`);
  console.log(`================================`);
  
  const aegis = new Aegis(connection, {
    publicKey: PublicKey.default,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  } as Wallet, { programId });
  
  for (const poolResult of pools) {
    const { pool, pair } = poolResult;
    
    try {
      // Refresh pool data
      const updatedPool = await aegis.getPool(pair.mintA, pair.mintB);
      
      if (updatedPool) {
        // Get vault balances
        const [vaultA, vaultB] = await Promise.all([
          getAccount(connection, updatedPool.info.vaultA).catch(() => null),
          getAccount(connection, updatedPool.info.vaultB).catch(() => null),
        ]);
        
        const balanceA = vaultA ? Number(vaultA.amount) / Math.pow(10, pair.decimalsA) : 0;
        const balanceB = vaultB ? Number(vaultB.amount) / Math.pow(10, pair.decimalsB) : 0;
        
        console.log(`\n${pair.symbolA}/${pair.symbolB}:`);
        console.log(`  Address: ${updatedPool.info.address.toString()}`);
        console.log(`  Liquidity: ${balanceA.toFixed(2)} ${pair.symbolA} / ${balanceB.toFixed(2)} ${pair.symbolB}`);
        console.log(`  LP Supply: ${updatedPool.info.lpSupply.toString()}`);
        console.log(`  Fee: ${updatedPool.info.feeBps / 100}%`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Failed to fetch pool status: ${error.message}`);
    }
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log(`\n🚀 Aegis Protocol - Pool Initialization & Volume Generation`);
  console.log(`==========================================================`);
  
  // Parse CLI arguments
  const args = parseArgs();
  console.log(`\nConfiguration:`);
  console.log(`  Pools to create: ${args.pools}`);
  console.log(`  Swaps per pool: ${args.swaps}`);
  console.log(`  Wallets: ${args.wallets}`);
  console.log(`  Liquidity per wallet: ${args.liquidity} base units`);
  console.log(`  Swap amount range: ${args.minSwap}-${args.maxSwap} base units`);
  console.log(`  RPC: ${RPC_URL}`);
  console.log(`  Program ID: ${PROGRAM_ID}`);
  
  // Connect to devnet
  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`\n🔗 Connected to ${RPC_URL}`);
  
  // Load wallets
  console.log(`\n👛 Loading wallets...`);
  const wallets = loadWallets(args.wallets);
  console.log(`✅ Loaded ${wallets.length} wallets`);
  
  // Ensure first wallet has SOL (will be used as creator)
  const creatorKeypair = walletToKeypair(wallets[0]);
  console.log(`\n💰 Ensuring creator wallet has SOL...`);
  await ensureBalance(connection, creatorKeypair, 2);
  
  const creatorWallet = createWallet(creatorKeypair, connection);
  const programId = new PublicKey(PROGRAM_ID);
  
  // Load token mints
  console.log(`\n🪙 Loading token mints...`);
  const tokenMints = DEFAULT_TOKEN_MINTS.map(mint => new PublicKey(mint));
  console.log(`✅ Loaded ${tokenMints.length} token mints`);
  
  // Get token metadata
  console.log(`\n📋 Fetching token metadata...`);
  const pairs: TokenPair[] = [];
  const generatedPairs = generateTokenPairs(tokenMints);
  
  for (const pair of generatedPairs.slice(0, args.pools)) {
    const [metadataA, metadataB] = await Promise.all([
      getTokenMetadata(connection, pair.mintA),
      getTokenMetadata(connection, pair.mintB),
    ]);
    
    pairs.push({
      ...pair,
      symbolA: metadataA.symbol,
      symbolB: metadataB.symbol,
      decimalsA: metadataA.decimals,
      decimalsB: metadataB.decimals,
    });
    
    console.log(`  ✅ ${metadataA.symbol}/${metadataB.symbol}`);
  }
  
  // Create pools
  const poolResults = await createPools(
    connection,
    programId,
    pairs,
    args.pools,
    creatorWallet,
    creatorKeypair
  );
  
  console.log(`\n✅ Created ${poolResults.length} pools`);
  
  // Add liquidity
  await addLiquidityToPools(
    connection,
    programId,
    poolResults,
    wallets,
    args.liquidity
  );
  
  // Generate volume
  await generateVolume(
    connection,
    programId,
    poolResults,
    wallets,
    args.swaps,
    args.minSwap,
    args.maxSwap
  );
  
  // Monitor pools
  await monitorPools(connection, programId, poolResults);
  
  console.log(`\n✅ Script completed successfully!`);
  console.log(`\n⚠️  Remember: This is DEVNET ONLY - never use on mainnet!`);
}

// Run script
main().catch((error) => {
  console.error(`\n❌ Fatal error:`, error);
  process.exit(1);
});
