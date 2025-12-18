#!/usr/bin/env ts-node
/**
 * Transfer Tokens to Treasury
 * 
 * Transfere tokens da mint authority wallet para a treasury
 * OU minta diretamente na treasury usando a mint authority
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  transfer,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPath = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../.env.local'),
].find(p => fs.existsSync(p)) || path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const MINT_AUTHORITY = 'J7vboBgPZojoVBqi1X55hoy4z7AZSb8mKppCSoAZTBxD';

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function loadTokensConfig() {
  const tokensPath = process.env.TOKENS_CONFIG_PATH || path.join(__dirname, '../config/devnet.tokens.json');
  const data = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  return data.tokens || data;
}

async function main() {
  console.log('\n💸 Transfer Tokens to Treasury\n');
  console.log('='.repeat(60));

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || path.join(__dirname, '../../.secrets/devnet/treasury.json');
  
  const treasury = loadKeypair(treasuryPath);
  const connection = new Connection(rpcUrl, 'confirmed');
  
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);
  console.log(`🔑 Mint Authority: ${MINT_AUTHORITY}\n`);

  // Try to load mint authority keypair (might not exist)
  let mintAuthorityKeypair: Keypair | null = null;
  const possiblePaths = [
    path.join(__dirname, '../../.secrets/devnet/mint-authority.json'),
    path.join(__dirname, '../../.secrets/mint-authority.json'),
    process.env.MINT_AUTHORITY_KEYPAIR_PATH,
  ].filter(Boolean) as string[];

  for (const keypairPath of possiblePaths) {
    if (keypairPath && fs.existsSync(keypairPath)) {
      try {
        mintAuthorityKeypair = loadKeypair(keypairPath);
        console.log(`✅ Found mint authority keypair: ${keypairPath}\n`);
        break;
      } catch {}
    }
  }

  if (!mintAuthorityKeypair) {
    console.log(`⚠️  Mint authority keypair not found.`);
    console.log(`💡 Please provide the keypair file for: ${MINT_AUTHORITY}`);
    console.log(`   Or set MINT_AUTHORITY_KEYPAIR_PATH in .env.local\n`);
    return;
  }

  const tokens = await loadTokensConfig();
  const tokensToProcess = tokens.filter((t: any) => 
    t.mint !== 'So1111111111111111111111111111111112' &&
    t.mint !== 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  );

  console.log(`📦 Processing ${tokensToProcess.length} tokens...\n`);

  const targetAmount = 1_000_000_000; // 1 billion tokens

  for (const tokenConfig of tokensToProcess) {
    try {
      const mintPubkey = new PublicKey(tokenConfig.mint);
      const mintInfo = await getMint(connection, mintPubkey);

      // Get treasury ATA (create if doesn't exist)
      const treasuryATA = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mintPubkey,
        treasury.publicKey
      );

      // Check treasury balance
      const treasuryBalance = await getAccount(connection, treasuryATA.address).catch(() => null);
      const currentBalance = treasuryBalance ? Number(treasuryBalance.amount) : 0;
      const targetBalance = targetAmount * (10 ** mintInfo.decimals);

      if (currentBalance >= targetBalance) {
        console.log(`  ✓ ${tokenConfig.symbol}: Already has ${currentBalance} tokens\n`);
        continue;
      }

      const needed = targetBalance - currentBalance;

      // Mint directly to treasury (simpler approach)
      console.log(`  🪙 Minting ${needed} ${tokenConfig.symbol} to treasury...`);
      await mintTo(
        connection,
        mintAuthorityKeypair,
        mintPubkey,
        treasuryATA.address,
        mintAuthorityKeypair,
        needed
      );
      console.log(`  ✅ Minted ${needed} ${tokenConfig.symbol}\n`);

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`  ❌ Error processing ${tokenConfig.symbol}: ${error.message || error}\n`);
      if (error.logs) {
        console.error(`  Logs:`, error.logs);
      }
    }
  }

  console.log('='.repeat(60));
  console.log('✅ Transfer completed!\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
