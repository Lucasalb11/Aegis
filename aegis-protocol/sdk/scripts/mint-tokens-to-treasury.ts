#!/usr/bin/env ts-node
/**
 * Mint Tokens to Treasury
 * 
 * Minta todos os tokens configurados diretamente na treasury wallet
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

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

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
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
  console.log('\n🪙 Mint Tokens to Treasury\n');
  console.log('='.repeat(60));

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || path.join(__dirname, '../../.secrets/devnet/treasury.json');
  
  console.log(`🔗 RPC: ${rpcUrl}\n`);

  const treasury = loadKeypair(treasuryPath);
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);
  
  const connection = new Connection(rpcUrl, 'confirmed');
  const balance = await connection.getBalance(treasury.publicKey);
  console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  // Load tokens
  const tokens = await loadTokensConfig();
  console.log(`📋 Loaded ${tokens.length} tokens\n`);

  // Filter out SOL and USDC (they're not mintable)
  const tokensToMint = tokens.filter(t => 
    t.mint !== 'So1111111111111111111111111111111112' &&
    t.mint !== 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  );

  console.log(`🪙 Minting ${tokensToMint.length} tokens to treasury...\n`);

  const mintAmount = 1_000_000_000; // 1 billion tokens (will be multiplied by decimals)

  for (const tokenConfig of tokensToMint) {
    try {
      const mintPubkey = new PublicKey(tokenConfig.mint);
      
      // Check if mint exists
      let mintInfo;
      try {
        mintInfo = await getMint(connection, mintPubkey);
        console.log(`  ✓ Token ${tokenConfig.symbol} exists (${mintInfo.decimals} decimals)`);
      } catch (error) {
        console.log(`  ⚠️  Token ${tokenConfig.symbol} not found, skipping...`);
        continue;
      }

      // Get or create ATA for treasury
      const treasuryATA = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mintPubkey,
        treasury.publicKey
      );

      // Check current balance
      const currentBalance = treasuryATA.amount;
      const targetAmount = BigInt(mintAmount) * BigInt(10 ** mintInfo.decimals);
      
      if (currentBalance >= targetAmount) {
        console.log(`    ✓ Already has ${currentBalance.toString()} tokens (target: ${targetAmount.toString()})\n`);
        continue;
      }

      // Calculate amount to mint
      const amountToMint = targetAmount - currentBalance;
      
      console.log(`    💰 Minting ${amountToMint.toString()} ${tokenConfig.symbol}...`);

      // Mint tokens (treasury needs to be mint authority)
      // Try to mint - if treasury is not mint authority, this will fail
      try {
        await mintTo(
          connection,
          treasury,
          mintPubkey,
          treasuryATA.address,
          treasury, // Using treasury as mint authority
          Number(amountToMint)
        );
        console.log(`    ✅ Minted ${amountToMint.toString()} ${tokenConfig.symbol}\n`);
      } catch (error: any) {
        if (error.message.includes('mint authority')) {
          console.log(`    ⚠️  Treasury is not mint authority for ${tokenConfig.symbol}`);
          console.log(`    💡 You need to mint manually or transfer from mint authority wallet\n`);
        } else {
          throw error;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`    ❌ Error minting ${tokenConfig.symbol}: ${error.message}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('✅ Token minting completed!\n');
  
  // Show final balances
  console.log('📊 Final Token Balances:\n');
  for (const tokenConfig of tokensToMint) {
    try {
      const mintPubkey = new PublicKey(tokenConfig.mint);
      const treasuryATA = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mintPubkey,
        treasury.publicKey
      );
      const balance = treasuryATA.amount;
      console.log(`  ${tokenConfig.symbol}: ${balance.toString()}`);
    } catch {}
  }
  console.log('');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}
