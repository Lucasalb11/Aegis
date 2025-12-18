#!/usr/bin/env ts-node
/**
 * Seed Devnet Liquidity Script
 * 
 * Idempotent script to seed initial liquidity for Aegis Protocol pools on devnet.
 * Creates pools if they don't exist, adds liquidity, and funds test wallets.
 * 
 * Usage: npm run seed:devnet
 * 
 * Environment variables (from .env.local):
 * - SOLANA_RPC_URL
 * - AEGIS_PROGRAM_ID
 * - COMMITMENT
 * - TREASURY_KEYPAIR_PATH
 * - WALLETS_DIR
 * - TOKENS_CONFIG_PATH
 * - POOLS_OUT_PATH
 * - BASE_TOKEN_MINT
 * - INITIAL_SOL_PER_WALLET
 * - INITIAL_TOKEN_PER_WALLET
 * - INITIAL_LIQUIDITY_USD_EQUIV
 * - FEE_BPS
 * - DRY_RUN
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import BN from 'bn.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Aegis, Wallet } from '../src/aegis';
import { Pool } from '../src/pool';

// Load environment variables
// Try SDK directory first, then project root
const envPath = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../.env.local'),
].find(p => fs.existsSync(p)) || path.join(__dirname, '../.env.local');

dotenv.config({ path: envPath });

interface TokenConfig {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface PoolConfig {
  mintA: PublicKey;
  mintB: PublicKey;
  poolAddress: PublicKey;
  vaultA: PublicKey;
  vaultB: PublicKey;
  lpMint: PublicKey;
  feeBps: number;
  createdAt: number;
}

interface PoolsOutput {
  pools: Array<{
    mintA: string;
    mintB: string;
    poolAddress: string;
    vaultA: string;
    vaultB: string;
    lpMint: string;
    feeBps: number;
    decimalsA: number;
    decimalsB: number;
    timestamp: number;
  }>;
  createdAt: number;
}

// Simple Wallet implementation
class KeypairWallet implements Wallet {
  constructor(public keypair: Keypair) {}

  get publicKey() {
    return this.keypair.publicKey;
  }

  async signTransaction(tx: Transaction): Promise<Transaction> {
    tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return txs.map((tx) => {
      tx.partialSign(this.keypair);
      return tx;
    });
  }
}

// Configuration from environment
const config = {
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  programId: new PublicKey(process.env.AEGIS_PROGRAM_ID || 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu'),
  commitment: (process.env.COMMITMENT || 'confirmed') as 'confirmed' | 'finalized' | 'processed',
  treasuryKeypairPath: process.env.TREASURY_KEYPAIR_PATH || path.join(__dirname, '../../.secrets/devnet/treasury.json'),
  walletsDir: process.env.WALLETS_DIR || path.join(__dirname, '../../local/wallets'),
  tokensConfigPath: process.env.TOKENS_CONFIG_PATH || path.join(__dirname, '../config/devnet.tokens.json'),
  poolsOutPath: process.env.POOLS_OUT_PATH || path.join(__dirname, '../config/devnet.pools.json'),
  baseTokenMint: process.env.BASE_TOKEN_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC devnet
  initialSolPerWallet: parseFloat(process.env.INITIAL_SOL_PER_WALLET || '0.25'),
  initialTokenPerWallet: parseFloat(process.env.INITIAL_TOKEN_PER_WALLET || '100'),
  initialLiquidityUsdEquiv: parseFloat(process.env.INITIAL_LIQUIDITY_USD_EQUIV || '1000'),
  feeBps: parseInt(process.env.FEE_BPS || '30'),
  dryRun: process.env.DRY_RUN === 'true',
};

// Statistics
const stats = {
  poolsCreated: 0,
  poolsExisting: 0,
  poolsToppedUp: 0,
  walletsFunded: 0,
  errors: [] as string[],
};

async function loadKeypair(filePath: string): Promise<Keypair> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Keypair file not found: ${filePath}`);
  }
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function loadTokensConfig(): Promise<TokenConfig[]> {
  if (!fs.existsSync(config.tokensConfigPath)) {
    const examplePath = config.tokensConfigPath.replace('.json', '.example.json');
    if (fs.existsSync(examplePath)) {
      throw new Error(
        `Tokens config not found. Please copy ${examplePath} to ${config.tokensConfigPath} and configure it.`
      );
    }
    throw new Error(`Tokens config not found: ${config.tokensConfigPath}`);
  }
  const data = JSON.parse(fs.readFileSync(config.tokensConfigPath, 'utf8'));
  return data.tokens || data;
}

async function loadWallets(): Promise<Keypair[]> {
  const wallets: Keypair[] = [];
  
  if (!fs.existsSync(config.walletsDir)) {
    console.warn(`⚠️  Wallets directory not found: ${config.walletsDir}`);
    console.warn(`   Creating 50 test wallets...`);
    fs.mkdirSync(config.walletsDir, { recursive: true });
    
    for (let i = 0; i < 50; i++) {
      const wallet = Keypair.generate();
      const walletPath = path.join(config.walletsDir, `wallet-${i}.json`);
      fs.writeFileSync(walletPath, JSON.stringify(Array.from(wallet.secretKey)));
      wallets.push(wallet);
    }
    
    console.log(`✅ Created ${wallets.length} wallets in ${config.walletsDir}`);
  } else {
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
  }
  
  return wallets;
}

async function validateToken(connection: Connection, mint: PublicKey): Promise<{ decimals: number; exists: boolean }> {
  try {
    const mintInfo = await getMint(connection, mint);
    return { decimals: mintInfo.decimals, exists: true };
  } catch (error) {
    return { decimals: 6, exists: false };
  }
}

async function ensureATA(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  return (await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner
  )).address;
}

async function getOrCreatePool(
  aegis: Aegis,
  mintA: PublicKey,
  mintB: PublicKey,
  feeBps: number
): Promise<{ pool: Pool; created: boolean }> {
  let pool = await aegis.getPool(mintA, mintB);
  if (pool) {
    return { pool, created: false };
  }
  
  console.log(`  Creating pool ${mintA.toString().slice(0, 8)}.../${mintB.toString().slice(0, 8)}...`);
  pool = await Pool.create(aegis, mintA, mintB, feeBps, (aegis.wallet as KeypairWallet).keypair);
  return { pool, created: true };
}

async function addLiquidityToPool(
  aegis: Aegis,
  pool: Pool,
  treasury: Keypair,
  amountA: BN,
  amountB: BN
): Promise<void> {
  const treasuryATA_A = await ensureATA(
    aegis.connection,
    treasury,
    pool.info.mintA,
    treasury.publicKey
  );
  const treasuryATA_B = await ensureATA(
    aegis.connection,
    treasury,
    pool.info.mintB,
    treasury.publicKey
  );
  const treasuryLP = await ensureATA(
    aegis.connection,
    treasury,
    pool.info.lpMint,
    treasury.publicKey
  );

  // Check balances
  const balanceA = await getAccount(aegis.connection, treasuryATA_A).catch(() => null);
  const balanceB = await getAccount(aegis.connection, treasuryATA_B).catch(() => null);

  const balanceABN = balanceA ? new BN(balanceA.amount.toString()) : new BN(0);
  const balanceBBN = balanceB ? new BN(balanceB.amount.toString()) : new BN(0);

  if (!balanceA || balanceABN.lt(amountA)) {
    throw new Error(`Insufficient balance for ${pool.info.mintA.toString()}: need ${amountA.toString()}, have ${balanceABN.toString()}`);
  }
  if (!balanceB || balanceBBN.lt(amountB)) {
    throw new Error(`Insufficient balance for ${pool.info.mintB.toString()}: need ${amountB.toString()}, have ${balanceBBN.toString()}`);
  }

  // Use treasury wallet wrapper
  const treasuryWallet = new KeypairWallet(treasury);
  const aegisWithTreasury = new Aegis(aegis.connection, treasuryWallet, { programId: aegis.programId });
  
  // Get pool instance with treasury wallet
  const poolWithTreasury = new Pool(aegisWithTreasury, pool.info);

  await poolWithTreasury.addLiquidity(
    { amountA, amountB },
    treasuryATA_A,
    treasuryATA_B,
    treasuryLP
  );
}

async function fundWallet(
  connection: Connection,
  treasury: Keypair,
  wallet: PublicKey,
  amountLamports: number
): Promise<string> {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: wallet,
      lamports: amountLamports,
    })
  );
  
  return (await sendAndConfirmTransaction(
    connection,
    transaction,
    [treasury],
    { commitment: config.commitment }
  ));
}

async function fundWalletWithToken(
  connection: Connection,
  treasury: Keypair,
  wallet: PublicKey,
  mint: PublicKey,
  amount: BN
): Promise<string> {
  const treasuryATA = await ensureATA(connection, treasury, mint, treasury.publicKey);
  const walletATA = await ensureATA(connection, treasury, mint, wallet);

  const transaction = new Transaction().add(
    createTransferInstruction(
      treasuryATA,
      walletATA,
      treasury.publicKey,
      amount.toNumber(),
      [],
      TOKEN_PROGRAM_ID
    )
  );

  return (await sendAndConfirmTransaction(
    connection,
    transaction,
    [treasury],
    { commitment: config.commitment }
  ));
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🌱 Aegis Protocol - Devnet Liquidity Seeding\n');
  console.log('='.repeat(60));
  
  if (config.dryRun) {
    console.log('⚠️  DRY RUN MODE - No transactions will be sent\n');
  }

  // Initialize connection
  const connection = new Connection(config.rpcUrl, config.commitment);
  console.log(`🔗 RPC: ${config.rpcUrl}`);
  console.log(`📦 Program ID: ${config.programId.toString()}\n`);

  // Load treasury
  console.log('📂 Loading treasury...');
  const treasury = await loadKeypair(config.treasuryKeypairPath);
  const treasuryBalance = await connection.getBalance(treasury.publicKey);
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);
  console.log(`💰 Balance: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  if (treasuryBalance < 0.1 * LAMPORTS_PER_SOL) {
    throw new Error('Treasury has insufficient SOL. Please fund it first.');
  }

  // Load tokens config
  console.log('📋 Loading tokens configuration...');
  const tokens = await loadTokensConfig();
  console.log(`✅ Loaded ${tokens.length} tokens\n`);

  // Validate tokens
  console.log('🔍 Validating tokens on devnet...');
  const validatedTokens: Array<TokenConfig & { mintPubkey: PublicKey; decimals: number }> = [];
  for (const token of tokens) {
    try {
      // Skip SOL wrapped token - it's a special case
      if (token.mint === 'So1111111111111111111111111111111112') {
        console.log(`  ⏭️  Skipping wrapped SOL (use native SOL or another base token)`);
        continue;
      }
      
      const mintPubkey = new PublicKey(token.mint);
      const { decimals, exists } = await validateToken(connection, mintPubkey);
      if (!exists) {
        console.warn(`⚠️  Token ${token.symbol} (${token.mint}) not found on-chain - skipping`);
        stats.errors.push(`Token ${token.symbol} not found`);
      } else {
        validatedTokens.push({ ...token, mintPubkey, decimals });
        console.log(`  ✓ ${token.symbol} (${token.decimals} decimals)`);
      }
    } catch (error: any) {
      console.error(`❌ Invalid mint address for ${token.symbol}: ${token.mint}`);
      console.error(`   Error: ${error.message}`);
      stats.errors.push(`Invalid mint for ${token.symbol}: ${error.message}`);
    }
  }
  console.log(`✅ Validated ${validatedTokens.length} tokens\n`);

  // Find base token
  let baseToken = validatedTokens.find(t => t.mint === config.baseTokenMint);
  if (!baseToken && validatedTokens.length > 0) {
    // Fallback: use first token as base (typically USDC or first minted token)
    console.log(`⚠️  Base token ${config.baseTokenMint} not found, using first available token as base\n`);
    baseToken = validatedTokens[0];
  }
  
  if (!baseToken || validatedTokens.length < 2) {
    throw new Error(`Need at least 2 validated tokens to create pools. Found: ${validatedTokens.length}`);
  }
  
  const baseTokenFinal = baseToken;

  // Initialize Aegis client
  const wallet = new KeypairWallet(treasury);
  const aegis = new Aegis(connection, wallet, { programId: config.programId });

  // Create pools
  console.log('🏊 Creating/verifying pools...\n');
  const poolsConfig: PoolConfig[] = [];

  for (const token of validatedTokens) {
    if (token.mintPubkey.equals(baseTokenFinal.mintPubkey)) {
      continue; // Skip base token
    }

    const [mintA, mintB] = token.mintPubkey.toBuffer().compare(baseTokenFinal.mintPubkey.toBuffer()) < 0
      ? [token.mintPubkey, baseTokenFinal.mintPubkey]
      : [baseTokenFinal.mintPubkey, token.mintPubkey];

    try {
      const { pool, created } = await getOrCreatePool(aegis, mintA, mintB, config.feeBps);
      
      if (created) {
        stats.poolsCreated++;
        console.log(`  ✅ Created pool: ${token.symbol}/${baseTokenFinal.symbol}`);
      } else {
        stats.poolsExisting++;
        console.log(`  ℹ️  Pool exists: ${token.symbol}/${baseTokenFinal.symbol}`);
      }

      // Check if pool has liquidity
      let vaultABalance: BN;
      let vaultBBalance: BN;
      try {
        const vaultAAccount = await getAccount(connection, pool.info.vaultA);
        const vaultBAccount = await getAccount(connection, pool.info.vaultB);
        vaultABalance = new BN(vaultAAccount.amount.toString());
        vaultBBalance = new BN(vaultBAccount.amount.toString());
      } catch {
        vaultABalance = new BN(0);
        vaultBBalance = new BN(0);
      }

      const hasLiquidity = vaultABalance.gt(new BN(0)) || vaultBBalance.gt(new BN(0));

      // Check if pool needs liquidity (either no liquidity or dry run mode)
      if (!hasLiquidity || config.dryRun) {
        // Calculate initial liquidity amounts
        // Simple strategy: equal USD value for both sides
        const baseDecimals = baseTokenFinal.decimals;
        const tokenDecimals = token.decimals;
        
        // Convert USD equivalent to token amounts
        const baseAmount = Math.floor(config.initialLiquidityUsdEquiv * Math.pow(10, baseDecimals));
        const tokenAmount = Math.floor(config.initialLiquidityUsdEquiv * Math.pow(10, tokenDecimals));

        // Determine which amount goes to mintA and which to mintB
        // pool.info.mintA and pool.info.mintB are already ordered correctly
        const baseAmountBN = new BN(baseAmount);
        const tokenAmountBN = new BN(tokenAmount);
        
        // Map amounts to the correct mint based on pool ordering
        const actualAmountA = pool.info.mintA.equals(baseTokenFinal.mintPubkey)
          ? baseAmountBN
          : tokenAmountBN;
        const actualAmountB = pool.info.mintB.equals(baseTokenFinal.mintPubkey)
          ? baseAmountBN
          : tokenAmountBN;

        if (!config.dryRun) {
          try {
            // Check if we need to mint tokens first (for test tokens)
            // This is a simplified check - in production you'd verify token supply
            await addLiquidityToPool(aegis, pool, treasury, actualAmountA, actualAmountB);
            if (hasLiquidity) {
              stats.poolsToppedUp++;
              console.log(`  💧 Topped up liquidity: ${actualAmountA.toString()} / ${actualAmountB.toString()}`);
            } else {
              console.log(`  💧 Added initial liquidity: ${actualAmountA.toString()} / ${actualAmountB.toString()}`);
            }
          } catch (error: any) {
            console.error(`  ❌ Failed to add liquidity: ${error.message}`);
            stats.errors.push(`Failed to add liquidity to ${token.symbol}/${baseTokenFinal.symbol}: ${error.message}`);
          }
        } else {
          console.log(`  💧 [DRY RUN] Would add liquidity: ${actualAmountA.toString()} / ${actualAmountB.toString()}`);
        }
      } else {
        console.log(`  ✓ Pool already has liquidity`);
      }

      poolsConfig.push({
        mintA: pool.info.mintA,
        mintB: pool.info.mintB,
        poolAddress: pool.info.address,
        vaultA: pool.info.vaultA,
        vaultB: pool.info.vaultB,
        lpMint: pool.info.lpMint,
        feeBps: pool.info.feeBps,
        createdAt: Date.now(),
      });

      // Small delay to avoid rate limiting
      await sleep(500);
    } catch (error: any) {
      console.error(`  ❌ Error processing pool ${token.symbol}: ${error.message}`);
      stats.errors.push(`Error processing ${token.symbol}: ${error.message}`);
    }
  }

  // Save pools config
  const poolsOutput: PoolsOutput = {
    pools: poolsConfig.map(p => ({
      mintA: p.mintA.toString(),
      mintB: p.mintB.toString(),
      poolAddress: p.poolAddress.toString(),
      vaultA: p.vaultA.toString(),
      vaultB: p.vaultB.toString(),
      lpMint: p.lpMint.toString(),
      feeBps: p.feeBps,
      decimalsA: validatedTokens.find(t => t.mintPubkey.equals(p.mintA))?.decimals || 6,
      decimalsB: validatedTokens.find(t => t.mintPubkey.equals(p.mintB))?.decimals || 6,
      timestamp: p.createdAt,
    })),
    createdAt: Date.now(),
  };

  const poolsOutDir = path.dirname(config.poolsOutPath);
  if (!fs.existsSync(poolsOutDir)) {
    fs.mkdirSync(poolsOutDir, { recursive: true });
  }
  fs.writeFileSync(config.poolsOutPath, JSON.stringify(poolsOutput, null, 2));
  console.log(`\n💾 Saved pools config to ${config.poolsOutPath}`);

  // Fund wallets
  console.log('\n👛 Funding test wallets...\n');
  const wallets = await loadWallets();
  console.log(`📦 Loaded ${wallets.length} wallets\n`);

  const solAmountLamports = Math.floor(config.initialSolPerWallet * LAMPORTS_PER_SOL);
  const tokenAmountPerWallet = Math.floor(config.initialTokenPerWallet * Math.pow(10, 6)); // Assuming 6 decimals

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    try {
      // Fund SOL
      if (!config.dryRun) {
        await fundWallet(connection, treasury, wallet.publicKey, solAmountLamports);
        console.log(`  ✅ Wallet ${i + 1}/${wallets.length}: Funded ${config.initialSolPerWallet} SOL`);
      } else {
        console.log(`  [DRY RUN] Wallet ${i + 1}/${wallets.length}: Would fund ${config.initialSolPerWallet} SOL`);
      }

      // Fund tokens (base token + a few others for testing)
      // Prioritize base token, then first 2-3 other tokens
      const tokensToFund = [
        baseTokenFinal,
        ...validatedTokens.filter(t => !t.mintPubkey.equals(baseTokenFinal.mintPubkey)).slice(0, 2)
      ];
      
      for (const token of tokensToFund) {
        if (!config.dryRun) {
          try {
            const tokenAmount = Math.floor(config.initialTokenPerWallet * Math.pow(10, token.decimals));
            await fundWalletWithToken(
              connection,
              treasury,
              wallet.publicKey,
              token.mintPubkey,
              new BN(tokenAmount)
            );
            console.log(`    ✅ Funded ${token.symbol}: ${tokenAmount}`);
          } catch (error: any) {
            console.warn(`    ⚠️  Failed to fund ${token.symbol}: ${error.message}`);
            stats.errors.push(`Failed to fund wallet ${i + 1} with ${token.symbol}: ${error.message}`);
          }
        } else {
          const tokenAmount = Math.floor(config.initialTokenPerWallet * Math.pow(10, token.decimals));
          console.log(`    [DRY RUN] Would fund ${token.symbol}: ${tokenAmount}`);
        }
      }

      stats.walletsFunded++;
      
      // Rate limiting
      if (i < wallets.length - 1) {
        await sleep(200);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to fund wallet ${i + 1}: ${error.message}`);
      stats.errors.push(`Failed to fund wallet ${i + 1}: ${error.message}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Pools created:     ${stats.poolsCreated}`);
  console.log(`Pools existing:    ${stats.poolsExisting}`);
  console.log(`Pools topped up:   ${stats.poolsToppedUp}`);
  console.log(`Wallets funded:    ${stats.walletsFunded}`);
  console.log(`Errors:            ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  console.log(`\n💾 Pools config saved to: ${config.poolsOutPath}`);
  console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}
