#!/usr/bin/env ts-node
/**
 * Complete Devnet Setup Script
 * 
 * Este script faz tudo de uma vez:
 * 1. Fecha buffers e recupera SOL
 * 2. Tenta fazer upgrade do programa (se necessário)
 * 3. Cria pools entre tokens gerados e SOL
 * 4. Cria pools entre tokens (token-token)
 * 5. Distribui tokens para 50 wallets
 * 6. Adiciona liquidez inicial em todas as pools
 * 
 * Usage: npm run setup:devnet
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
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
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
  async signTransaction(tx: Transaction): Promise<Transaction> {
    tx.sign(this.keypair);
    return tx;
  }
  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return txs.map(tx => {
      tx.sign(this.keypair);
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
  const tokensPath = process.env.TOKENS_CONFIG_PATH || 
    path.join(__dirname, '../config/devnet.tokens.json');
  const data = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  return data.tokens || data;
}

async function loadOrCreateWallets(count: number, walletsDir: string): Promise<Keypair[]> {
  const wallets: Keypair[] = [];
  
  if (!fs.existsSync(walletsDir)) {
    fs.mkdirSync(walletsDir, { recursive: true });
  }
  
  const files = fs.readdirSync(walletsDir)
    .filter(f => f.startsWith('wallet-') && f.endsWith('.json'))
    .sort();
  
  // Load existing wallets
  for (const file of files.slice(0, count)) {
    const walletPath = path.join(walletsDir, file);
    try {
      const secret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      wallets.push(Keypair.fromSecretKey(new Uint8Array(secret)));
    } catch (error) {
      console.warn(`⚠️  Failed to load wallet ${file}:`, error);
    }
  }
  
  // Generate new wallets if needed
  while (wallets.length < count) {
    const wallet = Keypair.generate();
    const walletPath = path.join(walletsDir, `wallet-${wallets.length}.json`);
    fs.writeFileSync(walletPath, JSON.stringify(Array.from(wallet.secretKey)));
    wallets.push(wallet);
  }
  
  return wallets.slice(0, count);
}

async function main() {
  console.log('\n🚀 Aegis Protocol - Complete Devnet Setup\n');
  console.log('='.repeat(60));
  
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const programId = new PublicKey(process.env.AEGIS_PROGRAM_ID || 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu');
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || 
    path.join(__dirname, '../../../.secrets/devnet/treasury.json');
  const walletsDir = process.env.WALLETS_DIR || 
    path.join(__dirname, '../../../local/wallets');
  
  const connection = new Connection(rpcUrl, 'confirmed');
  const treasury = loadKeypair(treasuryPath);
  
  console.log(`🔗 RPC: ${rpcUrl}`);
  console.log(`📦 Program ID: ${programId.toString()}`);
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);
  
  const balance = await connection.getBalance(treasury.publicKey);
  console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  // Load tokens
  const tokens = await loadTokensConfig();
  console.log(`📋 Loaded ${tokens.length} tokens\n`);
  
  // Filter tokens (exclude SOL and USDC, use minted tokens)
  const mintedTokens = tokens.filter(t => 
    t.symbol !== 'SOL' && 
    t.symbol !== 'USDC' &&
    ['AEGIS', 'AERO', 'ABTC', 'AUSD', 'ASOL'].includes(t.symbol)
  );
  
  console.log(`🎯 Tokens para criar pools: ${mintedTokens.map(t => t.symbol).join(', ')}\n`);
  
  // Setup Aegis client
  const wallet = new KeypairWallet(treasury);
  const aegis = new Aegis(connection, wallet as any, { programId });
  
  const feeBps = parseInt(process.env.FEE_BPS || '30');
  const liquidityAmount = parseFloat(process.env.INITIAL_LIQUIDITY_USD_EQUIV || '1000');
  
  let poolsCreated = 0;
  let poolsExisting = 0;
  let liquidityAdded = 0;
  const poolsOutput: any[] = [];
  
  // STEP 1: Criar pools entre tokens (token-token) - não depende de upgrade
  console.log('='.repeat(60));
  console.log('STEP 1: Criando pools Token/Token\n');
  
  for (let i = 0; i < mintedTokens.length; i++) {
    for (let j = i + 1; j < mintedTokens.length; j++) {
      try {
        const tokenA = mintedTokens[i];
        const tokenB = mintedTokens[j];
        const mintA = new PublicKey(tokenA.mint);
        const mintB = new PublicKey(tokenB.mint);
        const [mintA_sorted, mintB_sorted] = sortMints(mintA, mintB);
        
        console.log(`  🏊 Criando pool ${tokenA.symbol}/${tokenB.symbol}...`);
        
        let pool: Pool | null = null;
        try {
          pool = await aegis.getPool(mintA_sorted, mintB_sorted);
          if (pool) {
            console.log(`    ⏭️  Pool já existe: ${pool.info.address.toString()}`);
            poolsExisting++;
            continue;
          }
        } catch {}
        
        try {
          pool = await aegis.getOrCreatePool(mintA_sorted, mintB_sorted, feeBps);
          console.log(`    ✅ Pool criada: ${pool.info.address.toString()}`);
          poolsCreated++;
        } catch (error: any) {
          console.error(`    ❌ Erro ao criar pool: ${error.message}`);
          continue;
        }
        
        // Add liquidity
        const amountA = Math.floor(liquidityAmount * Math.pow(10, tokenA.decimals));
        const amountB = Math.floor(liquidityAmount * Math.pow(10, tokenB.decimals));
        
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
        
        const balanceA = await getAccount(connection, userTokenA.address).catch(() => null);
        const balanceB = await getAccount(connection, userTokenB.address).catch(() => null);
        
        if (!balanceA || Number(balanceA.amount) < amountA) {
          console.log(`    ⚠️  Saldo insuficiente de ${tokenA.symbol}`);
          continue;
        }
        if (!balanceB || Number(balanceB.amount) < amountB) {
          console.log(`    ⚠️  Saldo insuficiente de ${tokenB.symbol}`);
          continue;
        }
        
        console.log(`    💧 Adicionando liquidez: ${amountA / Math.pow(10, tokenA.decimals)} ${tokenA.symbol} / ${amountB / Math.pow(10, tokenB.decimals)} ${tokenB.symbol}`);
        
        try {
          await pool.addLiquidity(
            { amountA: new BN(amountA), amountB: new BN(amountB) },
            userTokenA.address,
            userTokenB.address,
            userLp.address
          );
          console.log(`    ✅ Liquidez adicionada!\n`);
          liquidityAdded++;
        } catch (error: any) {
          console.error(`    ❌ Erro: ${error.message}\n`);
          continue;
        }
        
        poolsOutput.push({
          mintA: mintA_sorted.toString(),
          mintB: mintB_sorted.toString(),
          poolAddress: pool.info.address.toString(),
          vaultA: pool.info.vaultA.toString(),
          vaultB: pool.info.vaultB.toString(),
          lpMint: pool.info.lpMint.toString(),
          feeBps,
          decimalsA: tokenA.decimals,
          decimalsB: tokenB.decimals,
          timestamp: Date.now(),
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`  ❌ Erro: ${error.message}\n`);
      }
    }
  }
  
  // STEP 2: Carregar/criar 50 wallets
  console.log('='.repeat(60));
  console.log('STEP 2: Carregando/Criando 50 wallets\n');
  
  const wallets = await loadOrCreateWallets(50, walletsDir);
  console.log(`✅ ${wallets.length} wallets carregadas\n`);
  
  // STEP 3: Distribuir SOL e tokens para wallets
  console.log('='.repeat(60));
  console.log('STEP 3: Distribuindo SOL e tokens para wallets\n');
  
  const solPerWallet = parseFloat(process.env.INITIAL_SOL_PER_WALLET || '0.25');
  const tokenPerWallet = parseFloat(process.env.INITIAL_TOKEN_PER_WALLET || '10000');
  
  let walletsFunded = 0;
  let tokensDistributed = 0;
  
  // Fund wallets with SOL
  console.log(`💰 Distribuindo ${solPerWallet} SOL por wallet...`);
  for (let i = 0; i < wallets.length; i++) {
    try {
      const balance = await connection.getBalance(wallets[i].publicKey);
      if (balance < solPerWallet * LAMPORTS_PER_SOL) {
        const needed = solPerWallet * LAMPORTS_PER_SOL - balance;
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: treasury.publicKey,
            toPubkey: wallets[i].publicKey,
            lamports: needed,
          })
        );
        await sendAndConfirmTransaction(connection, tx, [treasury]);
        walletsFunded++;
      }
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ ${i + 1}/${wallets.length} wallets financiadas...`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error(`  ❌ Erro ao financiar wallet ${i}: ${error.message}`);
    }
  }
  console.log(`✅ ${walletsFunded} wallets financiadas com SOL\n`);
  
  // Distribute tokens to wallets
  console.log(`🪙 Distribuindo tokens para wallets...`);
  for (const token of mintedTokens) {
    try {
      const tokenMint = new PublicKey(token.mint);
      const amount = Math.floor(tokenPerWallet * Math.pow(10, token.decimals));
      
      const treasuryToken = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        tokenMint,
        treasury.publicKey
      );
      
      const treasuryBalance = await getAccount(connection, treasuryToken.address);
      const totalNeeded = amount * wallets.length;
      
      if (Number(treasuryBalance.amount) < totalNeeded) {
        console.log(`  ⚠️  Saldo insuficiente de ${token.symbol} na treasury: precisa ${totalNeeded}, tem ${treasuryBalance.amount.toString()}`);
        continue;
      }
      
      let distributed = 0;
      for (let i = 0; i < wallets.length; i++) {
        try {
          const walletToken = await getOrCreateAssociatedTokenAccount(
            connection,
            treasury,
            tokenMint,
            wallets[i].publicKey
          );
          
          const walletBalance = await getAccount(connection, walletToken.address).catch(() => null);
          if (!walletBalance || Number(walletBalance.amount) < amount) {
            const needed = amount - (walletBalance ? Number(walletBalance.amount) : 0);
            const tx = new Transaction().add(
              createTransferInstruction(
                treasuryToken.address,
                walletToken.address,
                treasury.publicKey,
                needed
              )
            );
            await sendAndConfirmTransaction(connection, tx, [treasury]);
            distributed++;
            tokensDistributed++;
          }
          
          if ((i + 1) % 10 === 0) {
            console.log(`    ${token.symbol}: ${i + 1}/${wallets.length} wallets...`);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          console.error(`    ❌ Erro ao distribuir ${token.symbol} para wallet ${i}: ${error.message}`);
        }
      }
      console.log(`  ✅ ${token.symbol}: ${distributed} wallets receberam tokens\n`);
    } catch (error: any) {
      console.error(`  ❌ Erro processando ${token.symbol}: ${error.message}\n`);
    }
  }
  
  // Save pools output
  const poolsOutPath = process.env.POOLS_OUT_PATH || 
    path.join(__dirname, '../config/devnet.pools.json');
  fs.writeFileSync(poolsOutPath, JSON.stringify({
    pools: poolsOutput,
    createdAt: Date.now(),
  }, null, 2));
  
  console.log('='.repeat(60));
  console.log('📊 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Pools criadas:     ${poolsCreated}`);
  console.log(`Pools existentes: ${poolsExisting}`);
  console.log(`Liquidez adicionada: ${liquidityAdded} pools`);
  console.log(`Wallets financiadas: ${walletsFunded}`);
  console.log(`Tokens distribuídos: ${tokensDistributed} transferências`);
  console.log(`\n✅ Pools salvas em: ${poolsOutPath}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
