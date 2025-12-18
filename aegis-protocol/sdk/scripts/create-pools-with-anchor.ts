#!/usr/bin/env ts-node
/**
 * Create Pools with Anchor Client
 * 
 * Usa o Anchor client para criar pools corretamente, evitando o erro DeclaredProgramIdMismatch
 */

import * as anchor from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
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

// Load IDL
const idlPath = path.join(__dirname, '../../program/idl/aegis_protocol.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

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
  console.log('\n🏊 Aegis Protocol - Create Pools with Anchor\n');
  console.log('='.repeat(60));

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || path.join(__dirname, '../../.secrets/devnet/treasury.json');
  
  console.log(`🔗 RPC: ${rpcUrl}\n`);

  // Load treasury
  const treasury = loadKeypair(treasuryPath);
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);
  
  const connection = new Connection(rpcUrl, 'confirmed');
  const balance = await connection.getBalance(treasury.publicKey);
  console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  // Setup Anchor provider
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(treasury),
    { commitment: 'confirmed' }
  );
  anchor.setProvider(provider);

  // Get program ID from IDL
  const programId = new PublicKey(idl.address);
  console.log(`📦 Program ID: ${programId.toString()}\n`);

  // Create program instance - use same approach as working scripts
  const slimIdl = { ...idl, accounts: [] };
  const coder = new anchor.BorshCoder(idl);
  // @ts-ignore - Anchor Program constructor accepts this signature
  const program = new anchor.Program(slimIdl as any, programId, provider, coder);

  // Load tokens
  const tokens = await loadTokensConfig();
  console.log(`📋 Loaded ${tokens.length} tokens\n`);

  // Filter out SOL and USDC (if not found), use AEGIS as base
  const baseTokenSymbol = 'AEGIS';
  const baseToken = tokens.find(t => t.symbol === baseTokenSymbol);
  if (!baseToken) {
    throw new Error(`Base token ${baseTokenSymbol} not found`);
  }

  const baseTokenMint = new PublicKey(baseToken.mint);
  const otherTokens = tokens.filter(t => 
    t.symbol !== baseTokenSymbol && 
    t.mint !== 'So1111111111111111111111111111111112' &&
    t.mint !== 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  );

  console.log(`🎯 Base token: ${baseTokenSymbol} (${baseTokenMint.toString()})\n`);
  console.log(`📦 Creating pools for ${otherTokens.length} tokens:\n`);

  const feeBps = parseInt(process.env.FEE_BPS || '30');
  const liquidityAmount = parseFloat(process.env.INITIAL_LIQUIDITY_USD_EQUIV || '1000');

  // Create pools
  for (const token of otherTokens) {
    try {
      const tokenMint = new PublicKey(token.mint);
      const [mintA, mintB] = sortMints(baseTokenMint, tokenMint);

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), mintA.toBuffer(), mintB.toBuffer()],
        programId
      );

      // Check if pool already exists
      try {
        const poolAccount = await connection.getAccountInfo(poolPda);
        if (poolAccount) {
          console.log(`  ⏭️  Pool ${baseTokenSymbol}/${token.symbol} already exists, skipping...`);
          continue;
        }
      } catch {}

      const [vaultA] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool_vault'), poolPda.toBuffer(), mintA.toBuffer()],
        programId
      );
      const [vaultB] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool_vault'), poolPda.toBuffer(), mintB.toBuffer()],
        programId
      );
      const [lpMint] = PublicKey.findProgramAddressSync(
        [Buffer.from('lp_mint'), poolPda.toBuffer()],
        programId
      );

      console.log(`  🏊 Creating pool ${baseTokenSymbol}/${token.symbol}...`);

      // Initialize pool
      await program.methods
        .initializePool(feeBps)
        .accounts({
          payer: treasury.publicKey,
          mintA,
          mintB,
          pool: poolPda,
          vaultA,
          vaultB,
          lpMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([treasury])
        .rpc();

      console.log(`    ✅ Pool created: ${poolPda.toString()}`);

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
        lpMint,
        treasury.publicKey
      );

      // Check balances
      const balanceA = await getAccount(connection, userTokenA.address).catch(() => null);
      const balanceB = await getAccount(connection, userTokenB.address).catch(() => null);

      if (!balanceA || Number(balanceA.amount) < amountA) {
        console.log(`    ⚠️  Insufficient ${baseTokenSymbol} balance: need ${amountA}, have ${balanceA?.amount.toString() || '0'}`);
        continue;
      }
      if (!balanceB || Number(balanceB.amount) < amountB) {
        console.log(`    ⚠️  Insufficient ${token.symbol} balance: need ${amountB}, have ${balanceB?.amount.toString() || '0'}`);
        continue;
      }

      console.log(`    💧 Adding liquidity: ${amountA} ${baseTokenSymbol} / ${amountB} ${token.symbol}`);

      await program.methods
        .addLiquidity(
          new anchor.BN(amountA.toString()),
          new anchor.BN(amountB.toString())
        )
        .accounts({
          user: treasury.publicKey,
          pool: poolPda,
          vaultA,
          vaultB,
          lpMint,
          userTokenA: userTokenA.address,
          userTokenB: userTokenB.address,
          userLpToken: userLp.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([treasury])
        .rpc();

      console.log(`    ✅ Liquidity added!\n`);

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`    ❌ Error creating pool ${token.symbol}: ${error.message}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('✅ Pool creation completed!\n');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}
