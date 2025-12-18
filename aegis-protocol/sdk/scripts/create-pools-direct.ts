#!/usr/bin/env ts-node
/**
 * Create Pools Directly using SDK Pool.create
 * 
 * Usa o método Pool.create do SDK que já funciona
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  mintTo,
} from '@solana/spl-token';
import BN from 'bn.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Aegis } from '../src/aegis';
import { Pool } from '../src/pool';

// Load environment variables
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

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

function sortMints(a: PublicKey, b: PublicKey): [PublicKey, PublicKey] {
  return a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
}

async function loadTokensConfig(): Promise<TokenConfig[]> {
  const tokensPath = process.env.TOKENS_CONFIG_PATH || path.join(__dirname, '../config/devnet.tokens.json');
  if (!fs.existsSync(tokensPath)) {
    throw new Error(`Tokens config not found: ${tokensPath}`);
  }
  const data = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  return data.tokens || data;
}

async function main() {
  console.log('\n🏊 Aegis Protocol - Create Pools (Direct SDK)\n');
  console.log('='.repeat(60));

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  // Use the deployed program ID (can be overridden by env var)
  const programId = new PublicKey(process.env.AEGIS_PROGRAM_ID || 'FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9');
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || path.join(__dirname, '../../.secrets/devnet/treasury.json');
  
  console.log(`🔗 RPC: ${rpcUrl}`);
  console.log(`📦 Program ID: ${programId.toString()}\n`);

  const treasury = loadKeypair(treasuryPath);
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);
  
  const connection = new Connection(rpcUrl, 'confirmed');
  const balance = await connection.getBalance(treasury.publicKey);
  console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  // Setup Aegis client
  const wallet = new KeypairWallet(treasury);
  const aegis = new Aegis(connection, wallet as any, { programId });

  // Load tokens
  const tokens = await loadTokensConfig();
  console.log(`📋 Loaded ${tokens.length} tokens\n`);

  // Use AEGIS as base token
  const baseToken = tokens.find(t => t.symbol === 'AEGIS');
  if (!baseToken) {
    throw new Error('AEGIS token not found');
  }

  const baseTokenMint = new PublicKey(baseToken.mint);
  const otherTokens = tokens.filter(t => 
    t.symbol !== 'AEGIS' && 
    t.mint !== 'So1111111111111111111111111111111112' &&
    t.mint !== 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  );

  console.log(`🎯 Base token: AEGIS (${baseTokenMint.toString()})\n`);
  console.log(`📦 Creating pools for ${otherTokens.length} tokens:\n`);

  const feeBps = parseInt(process.env.FEE_BPS || '30');
  const liquidityAmount = parseFloat(process.env.INITIAL_LIQUIDITY_USD_EQUIV || '1000');

  let poolsCreated = 0;
  let poolsExisting = 0;
  let liquidityAdded = 0;

  for (const token of otherTokens) {
    try {
      const tokenMint = new PublicKey(token.mint);
      const [mintA, mintB] = sortMints(baseTokenMint, tokenMint);

      // Use getOrCreatePool which handles everything
      console.log(`  🏊 Creating/getting pool AEGIS/${token.symbol}...`);
      let pool: Pool;
      try {
        pool = await aegis.getOrCreatePool(mintA, mintB, feeBps);
        const poolAccount = await connection.getAccountInfo(pool.info.address);
        if (poolAccount) {
          // Check if pool was just created or already existed
          const wasCreated = poolAccount.lamports === 0 || poolAccount.data.length < 100;
          if (wasCreated) {
            console.log(`    ✅ Pool created: ${pool.info.address.toString()}`);
            poolsCreated++;
          } else {
            console.log(`    ⏭️  Pool already exists: ${pool.info.address.toString()}`);
            poolsExisting++;
          }
        } else {
          console.log(`    ✅ Pool created: ${pool.info.address.toString()}`);
          poolsCreated++;
        }
      } catch (error: any) {
        console.error(`    ❌ Error: ${error.message}`);
        if (error.logs) {
          console.error(`    Logs:`, error.logs.slice(0, 3));
        }
        continue;
      }

      // Add liquidity
      const amountA = Math.floor(liquidityAmount * Math.pow(10, baseToken.decimals));
      const amountB = Math.floor(liquidityAmount * Math.pow(10, token.decimals));

      const userTokenA = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mintA,
        treasury.publicKey
      );
      const userTokenB = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mintB,
        treasury.publicKey
      );
      const userLp = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        pool.info.lpMint,
        treasury.publicKey
      );

      // Check balances
      const balanceA = await getAccount(connection, userTokenA.address).catch(() => null);
      const balanceB = await getAccount(connection, userTokenB.address).catch(() => null);

      if (!balanceA || Number(balanceA.amount) < amountA) {
        console.log(`    ⚠️  Insufficient AEGIS: need ${amountA}, have ${balanceA?.amount.toString() || '0'}\n`);
        continue;
      }
      if (!balanceB || Number(balanceB.amount) < amountB) {
        console.log(`    ⚠️  Insufficient ${token.symbol}: need ${amountB}, have ${balanceB?.amount.toString() || '0'}\n`);
        continue;
      }

      // Check if pool already has liquidity
      const vaultA = await getAccount(connection, pool.info.vaultA).catch(() => null);
      const vaultB = await getAccount(connection, pool.info.vaultB).catch(() => null);
      
      if (vaultA && vaultB && (Number(vaultA.amount) > 0 || Number(vaultB.amount) > 0)) {
        console.log(`    ✓ Pool already has liquidity\n`);
        continue;
      }

      console.log(`    💧 Adding liquidity: ${amountA} AEGIS / ${amountB} ${token.symbol}`);

      await pool.addLiquidity(
        { amountA: new BN(amountA), amountB: new BN(amountB) },
        userTokenA.address,
        userTokenB.address,
        userLp.address
      );

      console.log(`    ✅ Liquidity added!\n`);
      liquidityAdded++;

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`    ❌ Error: ${error.message}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Pools created:     ${poolsCreated}`);
  console.log(`Pools existing:    ${poolsExisting}`);
  console.log(`Liquidity added:   ${liquidityAdded}`);
  console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}
