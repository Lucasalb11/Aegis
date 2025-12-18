#!/usr/bin/env ts-node
/**
 * Script Otimizado para Criar Pools com SOL Limitado
 * 
 * Estratégia:
 * 1. Verifica pools existentes e adiciona liquidez se necessário
 * 2. Cria apenas pools essenciais token-token (não token-SOL)
 * 3. Prioriza pools mais importantes (AEGIS com outros tokens)
 * 4. Usa SOL de forma eficiente, criando apenas o necessário
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
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

async function checkPoolExists(
  connection: Connection,
  programId: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey
): Promise<boolean> {
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), mintA.toBuffer(), mintB.toBuffer()],
    programId
  );
  
  try {
    const account = await connection.getAccountInfo(poolAddress);
    return account !== null;
  } catch {
    return false;
  }
}

async function checkPoolHasLiquidity(
  connection: Connection,
  programId: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey
): Promise<boolean> {
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), mintA.toBuffer(), mintB.toBuffer()],
    programId
  );
  
  try {
    const poolInfo = await connection.getAccountInfo(poolAddress);
    if (!poolInfo) return false;
    
    // Verificar se pool tem lp_supply > 0 (simplificado)
    // Na prática, precisaríamos deserializar a conta Pool
    return true; // Assumir que se existe, pode ter liquidez
  } catch {
    return false;
  }
}

async function createPoolOptimized(
  aegis: Aegis,
  treasury: Keypair,
  mintA: PublicKey,
  mintB: PublicKey,
  symbolA: string,
  symbolB: string,
  feeBps: number
): Promise<{ success: boolean; poolAddress?: string }> {
  try {
    const [mintASorted, mintBSorted] = sortMints(mintA, mintB);
    
    // Verificar se pool já existe
    const exists = await checkPoolExists(aegis.connection, aegis.programId, mintASorted, mintBSorted);
    if (exists) {
      console.log(`  ⏭️  Pool ${symbolA}/${symbolB} já existe`);
      const [poolAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), mintASorted.toBuffer(), mintBSorted.toBuffer()],
        aegis.programId
      );
      return { success: true, poolAddress: poolAddress.toString() };
    }
    
    console.log(`  🏊 Criando pool ${symbolA}/${symbolB}...`);
    const pool = await Pool.create(
      aegis,
      mintASorted,
      mintBSorted,
      feeBps,
      treasury
    );
    
    console.log(`    ✅ Pool criada: ${pool.info.address.toString()}`);
    return { success: true, poolAddress: pool.info.address.toString() };
  } catch (error: any) {
    console.error(`    ❌ Erro: ${error.message}`);
    return { success: false };
  }
}

async function addLiquidityIfNeeded(
  aegis: Aegis,
  treasury: Keypair,
  mintA: PublicKey,
  mintB: PublicKey,
  symbolA: string,
  symbolB: string,
  amountA: BN,
  amountB: BN
): Promise<boolean> {
  try {
    const [mintASorted, mintBSorted] = sortMints(mintA, mintB);
    const pool = await aegis.getPool(mintASorted, mintBSorted);
    
    if (!pool) {
      console.log(`    ⚠️  Pool ${symbolA}/${symbolB} não encontrada`);
      return false;
    }
    
    // Verificar saldos da treasury
    const treasuryATA_A = await getOrCreateAssociatedTokenAccount(
      aegis.connection,
      treasury,
      mintASorted,
      treasury.publicKey
    );
    const treasuryATA_B = await getOrCreateAssociatedTokenAccount(
      aegis.connection,
      treasury,
      mintBSorted,
      treasury.publicKey
    );
    
    const balanceA = await getAccount(aegis.connection, treasuryATA_A.address).catch(() => null);
    const balanceB = await getAccount(aegis.connection, treasuryATA_B.address).catch(() => null);
    
    if (!balanceA || new BN(balanceA.amount.toString()).lt(amountA)) {
      console.log(`    ⚠️  Saldo insuficiente de ${symbolA}`);
      return false;
    }
    if (!balanceB || new BN(balanceB.amount.toString()).lt(amountB)) {
      console.log(`    ⚠️  Saldo insuficiente de ${symbolB}`);
      return false;
    }
    
    // Verificar se pool já tem liquidez
    const lpMintInfo = await getMint(aegis.connection, pool.info.lpMint);
    if (lpMintInfo.supply > BigInt(0)) {
      console.log(`    ⏭️  Pool ${symbolA}/${symbolB} já tem liquidez`);
      return true;
    }
    
    // Adicionar liquidez
    const treasuryLP = await getOrCreateAssociatedTokenAccount(
      aegis.connection,
      treasury,
      pool.info.lpMint,
      treasury.publicKey
    );
    
    const treasuryWallet = new KeypairWallet(treasury);
    const aegisWithTreasury = new Aegis(aegis.connection, treasuryWallet, { programId: aegis.programId });
    const poolWithTreasury = new Pool(aegisWithTreasury, pool.info);
    
    await poolWithTreasury.addLiquidity(
      { amountA, amountB },
      treasuryATA_A.address,
      treasuryATA_B.address,
      treasuryLP.address
    );
    
    console.log(`    ✅ Liquidez adicionada: ${amountA.toString()} ${symbolA} / ${amountB.toString()} ${symbolB}`);
    return true;
  } catch (error: any) {
    console.error(`    ❌ Erro ao adicionar liquidez: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 SETUP OTIMIZADO DE POOLS - SOL LIMITADO\n');
  console.log('='.repeat(60));
  
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const programId = new PublicKey(process.env.AEGIS_PROGRAM_ID || 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu');
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || 
    path.join(__dirname, '../../.secrets/devnet/treasury.json');
  
  const connection = new Connection(rpcUrl, 'confirmed');
  const treasury = loadKeypair(treasuryPath);
  
  console.log(`🔗 RPC: ${rpcUrl}`);
  console.log(`📦 Program ID: ${programId.toString()}`);
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);
  
  const balance = await connection.getBalance(treasury.publicKey);
  console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    console.log('❌ SOL insuficiente! Precisa de pelo menos 0.01 SOL');
    process.exit(1);
  }
  
  // Carregar tokens
  const tokens = await loadTokensConfig();
  const aegisToken = tokens.find(t => t.symbol === 'AEGIS');
  const otherTokens = tokens.filter(t => 
    ['AERO', 'ABTC', 'AUSD', 'ASOL'].includes(t.symbol)
  );
  
  if (!aegisToken) {
    console.log('❌ Token AEGIS não encontrado!');
    process.exit(1);
  }
  
  const aegisMint = new PublicKey(aegisToken.mint);
  const aegisWallet = new KeypairWallet(treasury);
  const aegis = new Aegis(connection, aegisWallet, { programId });
  
  const feeBps = parseInt(process.env.FEE_BPS || '30');
  const liquidityAmount = parseFloat(process.env.INITIAL_LIQUIDITY_USD_EQUIV || '1000');
  
  console.log('📋 Estratégia Otimizada:\n');
  console.log('1. Verificar pools existentes e adicionar liquidez');
  console.log('2. Criar apenas pools essenciais token-token');
  console.log('3. Priorizar pools AEGIS com outros tokens\n');
  console.log('='.repeat(60));
  
  const poolsCreated: Array<{
    mintA: string;
    mintB: string;
    poolAddress: string;
    symbolA: string;
    symbolB: string;
  }> = [];
  
  let poolsCreatedCount = 0;
  let liquidityAddedCount = 0;
  
  // FASE 1: Adicionar liquidez às pools existentes
  console.log('\n📊 FASE 1: Adicionando liquidez às pools existentes\n');
  
  for (const token of otherTokens) {
    const tokenMint = new PublicKey(token.mint);
    const [mintASorted, mintBSorted] = sortMints(aegisMint, tokenMint);
    
    const exists = await checkPoolExists(connection, programId, mintASorted, mintBSorted);
    if (exists) {
      const amountA = new BN(Math.floor(liquidityAmount * Math.pow(10, aegisToken.decimals)));
      const amountB = new BN(Math.floor(liquidityAmount * Math.pow(10, token.decimals)));
      
      const added = await addLiquidityIfNeeded(
        aegis,
        treasury,
        aegisMint,
        tokenMint,
        'AEGIS',
        token.symbol,
        amountA,
        amountB
      );
      
      if (added) {
        liquidityAddedCount++;
      }
      
      const [poolAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), mintASorted.toBuffer(), mintBSorted.toBuffer()],
        programId
      );
      
      poolsCreated.push({
        mintA: mintASorted.toString(),
        mintB: mintBSorted.toString(),
        poolAddress: poolAddress.toString(),
        symbolA: 'AEGIS',
        symbolB: token.symbol,
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // FASE 2: Criar pools token-token essenciais (apenas se tiver SOL suficiente)
  console.log('\n📊 FASE 2: Criando pools token-token essenciais\n');
  
  // Priorizar: AERO/ABTC, AERO/AUSD, ABTC/AUSD (pools mais úteis)
  const essentialPairs = [
    ['AERO', 'ABTC'],
    ['AERO', 'AUSD'],
    ['ABTC', 'AUSD'],
  ];
  
  const currentBalance = await connection.getBalance(treasury.publicKey);
  const solAvailable = currentBalance / LAMPORTS_PER_SOL;
  
  // Cada pool precisa de ~0.003 SOL para rent
  const maxPoolsToCreate = Math.floor(solAvailable / 0.003);
  
  console.log(`💰 SOL disponível: ${solAvailable.toFixed(4)} SOL`);
  console.log(`📊 Pools que podemos criar: ~${maxPoolsToCreate}\n`);
  
  for (const [symbolA, symbolB] of essentialPairs.slice(0, Math.min(maxPoolsToCreate, essentialPairs.length))) {
    const tokenA = tokens.find(t => t.symbol === symbolA);
    const tokenB = tokens.find(t => t.symbol === symbolB);
    
    if (!tokenA || !tokenB) continue;
    
    const mintA = new PublicKey(tokenA.mint);
    const mintB = new PublicKey(tokenB.mint);
    
    const exists = await checkPoolExists(connection, programId, mintA, mintB);
    if (exists) {
      console.log(`  ⏭️  Pool ${symbolA}/${symbolB} já existe`);
      continue;
    }
    
    const result = await createPoolOptimized(
      aegis,
      treasury,
      mintA,
      mintB,
      symbolA,
      symbolB,
      feeBps
    );
    
    if (result.success && result.poolAddress) {
      poolsCreatedCount++;
      poolsCreated.push({
        mintA: sortMints(mintA, mintB)[0].toString(),
        mintB: sortMints(mintA, mintB)[1].toString(),
        poolAddress: result.poolAddress,
        symbolA,
        symbolB,
      });
      
      // Tentar adicionar liquidez
      await new Promise(resolve => setTimeout(resolve, 1000));
      const amountA = new BN(Math.floor(liquidityAmount * Math.pow(10, tokenA.decimals)));
      const amountB = new BN(Math.floor(liquidityAmount * Math.pow(10, tokenB.decimals)));
      
      await addLiquidityIfNeeded(
        aegis,
        treasury,
        mintA,
        mintB,
        symbolA,
        symbolB,
        amountA,
        amountB
      );
    }
    
    // Verificar se ainda tem SOL
    const remainingBalance = await connection.getBalance(treasury.publicKey);
    if (remainingBalance < 0.003 * LAMPORTS_PER_SOL) {
      console.log('\n⚠️  SOL insuficiente para criar mais pools');
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Salvar pools
  const poolsOutPath = process.env.POOLS_OUT_PATH || 
    path.join(__dirname, '../config/devnet.pools.json');
  
  const poolsOutput = poolsCreated.map(p => ({
    mintA: p.mintA,
    mintB: p.mintB,
    poolAddress: p.poolAddress,
    symbolA: p.symbolA,
    symbolB: p.symbolB,
    feeBps,
    timestamp: Date.now(),
  }));
  
  fs.writeFileSync(poolsOutPath, JSON.stringify({
    pools: poolsOutput,
    createdAt: Date.now(),
  }, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Pools existentes verificadas: ${poolsCreated.length}`);
  console.log(`Liquidez adicionada: ${liquidityAddedCount} pools`);
  console.log(`Novas pools criadas: ${poolsCreatedCount}`);
  console.log(`Total de pools: ${poolsCreated.length}`);
  console.log(`\n✅ Pools salvas em: ${poolsOutPath}`);
  
  const finalBalance = await connection.getBalance(treasury.publicKey);
  console.log(`💰 SOL restante: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
