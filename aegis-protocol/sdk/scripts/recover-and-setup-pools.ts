#!/usr/bin/env ts-node
/**
 * Recover SOL from buffers and setup pools one by one
 * 
 * 1. Recupera SOL de todos os buffers antigos
 * 2. Concentra SOL em uma wallet
 * 3. Faz upgrade do programa
 * 4. Cria pools uma por uma com verificação
 * 5. Adiciona liquidez em cada pool
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, getAccount, createTransferInstruction } from '@solana/spl-token';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import BN from 'bn.js';
import { Aegis } from '../src/aegis';
import { Pool } from '../src/pool';

const envPath = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../.env.local'),
].find(p => fs.existsSync(p)) || path.join(__dirname, '../.env.local');

dotenv.config({ path: envPath });

const UPGRADE_AUTHORITY = 'EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z';
const TREASURY_ADDRESS = '12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV';
const PROGRAM_ID = 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu';
const RPC_URL = 'https://api.devnet.solana.com';

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

function sortMints(a: PublicKey, b: PublicKey): [PublicKey, PublicKey] {
  return a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
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

async function closeAllBuffers(connection: Connection, upgradeAuthority: PublicKey): Promise<number> {
  console.log('\n🔍 Procurando buffers para fechar...\n');
  
  // Lista de buffers conhecidos de tentativas anteriores
  const knownBuffers = [
    'DJHxg4ZH4XAhNhPYAAcqCm5741NMFwo5vf5FdFyKtHmd',
    'A58vpufAm48e5Zb1iL1MdkTxJmsw1C8tdUq58yDH1k5E',
    'BmrhB1KmqvHYze1ohDLZspEqw26RX7pZgAnmoPed2ixj',
    '3hLLV7zgvhVrsDnCrN81Dn3Bb4NabFLPJSq3wDrhZHbm',
    'DCULzpFyQj6X5G2Z8Yegr9TiL2LicHpATMFrVsaVE3Vx',
    'e2FhwUHQ3KkxzFJw26cZRxwfmqkG76U4r9YmssvkRYS',
    'D4XLggMaWGqyUANn4shEsy1bYX4fY5f6sDEsvH9gLU7E',
  ];
  
  let recovered = 0;
  
  for (const bufferAddr of knownBuffers) {
    try {
      const output = execSync(
        `solana program close ${bufferAddr} --url devnet 2>&1`,
        { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
      );
      
      if (output.includes('Balance:')) {
        const balanceMatch = output.match(/Balance: ([\d.]+) SOL/);
        if (balanceMatch) {
          const balance = parseFloat(balanceMatch[1]);
          console.log(`  ✅ Buffer ${bufferAddr.substring(0, 8)}... fechado: ${balance.toFixed(4)} SOL`);
          recovered += balance;
        }
      } else if (output.includes('Unable to find')) {
        console.log(`  ⏭️  Buffer ${bufferAddr.substring(0, 8)}... já foi fechado`);
      }
    } catch (error: any) {
      const errorMsg = error.stdout || error.message || String(error);
      if (!errorMsg.includes('Unable to find') && !errorMsg.includes('authority')) {
        // Ignorar erros de buffer não encontrado ou sem autoridade
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n💰 Total recuperado: ${recovered.toFixed(4)} SOL\n`);
  return recovered;
}

async function transferSol(from: Keypair, to: PublicKey, amount: number, connection: Connection): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );
  const signature = await connection.sendTransaction(tx, [from]);
  await connection.confirmTransaction(signature);
  return signature;
}

async function upgradeProgram(upgradeAuthority: PublicKey): Promise<boolean> {
  console.log('\n🔄 Tentando fazer upgrade do programa...\n');
  
  const programDir = path.join(__dirname, '../../program');
  const soPath = path.join(programDir, 'target/deploy/aegis_protocol.so');
  
  if (!fs.existsSync(soPath)) {
    console.log('⚠️  Arquivo .so não encontrado. Compilando...\n');
    try {
      execSync('anchor build', { cwd: programDir, stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Erro ao compilar programa');
      return false;
    }
  }
  
  try {
    const output = execSync(
      `solana program deploy ${soPath} --program-id ${PROGRAM_ID} --url devnet --upgrade-authority /Users/lucas/.config/solana/id.json 2>&1`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    if (output.includes('Program Id:') || output.includes('Deploy success')) {
      console.log('✅ Upgrade bem-sucedido!\n');
      return true;
    } else {
      console.log('⚠️  Upgrade pode ter falhado. Verificando...\n');
      return false;
    }
  } catch (error: any) {
    const errorMsg = error.stdout || error.message || String(error);
    if (errorMsg.includes('insufficient funds')) {
      console.log('⚠️  SOL insuficiente para upgrade\n');
      return false;
    } else if (errorMsg.includes('write transactions failed')) {
      console.log('⚠️  Problemas de rede. Tentando novamente em 30s...\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
      return await upgradeProgram(upgradeAuthority);
    } else {
      console.log(`⚠️  Erro: ${errorMsg.split('\n')[0]}\n`);
      return false;
    }
  }
}

async function createPoolWithLiquidity(
  aegis: Aegis,
  connection: Connection,
  treasury: Keypair,
  tokenA: { mint: PublicKey; symbol: string; decimals: number },
  tokenB: { mint: PublicKey; symbol: string; decimals: number },
  liquidityAmount: number,
  feeBps: number
): Promise<{ success: boolean; poolAddress?: string }> {
  try {
    const [mintA, mintB] = sortMints(tokenA.mint, tokenB.mint);
    
    console.log(`  🏊 Criando pool ${tokenA.symbol}/${tokenB.symbol}...`);
    
    // Verificar se pool já existe
    let pool: Pool | null = null;
    try {
      pool = await aegis.getPool(mintA, mintB);
      if (pool) {
        console.log(`    ⏭️  Pool já existe: ${pool.info.address.toString()}`);
        return { success: true, poolAddress: pool.info.address.toString() };
      }
    } catch {}
    
    // Criar pool
    try {
      pool = await aegis.getOrCreatePool(mintA, mintB, feeBps);
      console.log(`    ✅ Pool criada: ${pool.info.address.toString()}`);
    } catch (error: any) {
      console.error(`    ❌ Erro ao criar pool: ${error.message}`);
      if (error.logs) {
        console.error(`    Logs:`, error.logs.slice(0, 3));
      }
      return { success: false };
    }
    
    // Aguardar confirmação
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Adicionar liquidez
    const amountA = Math.floor(liquidityAmount * Math.pow(10, tokenA.decimals));
    const amountB = Math.floor(liquidityAmount * Math.pow(10, tokenB.decimals));
    
    const userTokenA = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      tokenA.mint,
      treasury.publicKey
    );
    const userTokenB = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      tokenB.mint,
      treasury.publicKey
    );
    const userLp = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      pool.info.lpMint,
      treasury.publicKey
    );
    
    // Verificar saldos
    const balanceA = await getAccount(connection, userTokenA.address).catch(() => null);
    const balanceB = await getAccount(connection, userTokenB.address).catch(() => null);
    
    if (!balanceA || Number(balanceA.amount) < amountA) {
      console.log(`    ⚠️  Saldo insuficiente de ${tokenA.symbol}: precisa ${amountA}, tem ${balanceA?.amount.toString() || '0'}`);
      return { success: false };
    }
    if (!balanceB || Number(balanceB.amount) < amountB) {
      console.log(`    ⚠️  Saldo insuficiente de ${tokenB.symbol}: precisa ${amountB}, tem ${balanceB?.amount.toString() || '0'}`);
      return { success: false };
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
      return { success: true, poolAddress: pool.info.address.toString() };
    } catch (error: any) {
      console.error(`    ❌ Erro ao adicionar liquidez: ${error.message}\n`);
      return { success: false };
    }
  } catch (error: any) {
    console.error(`  ❌ Erro processando pool: ${error.message}\n`);
    return { success: false };
  }
}

async function main() {
  console.log('\n🚀 Aegis Protocol - Recover & Setup Pools\n');
  console.log('='.repeat(60));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const upgradeAuthorityPubkey = new PublicKey(UPGRADE_AUTHORITY);
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || 
    path.join(__dirname, '../../../.secrets/devnet/treasury.json');
  const treasury = loadKeypair(treasuryPath);
  
  // STEP 1: Recuperar SOL de buffers
  console.log('STEP 1: Recuperando SOL de buffers antigos\n');
  await closeAllBuffers(connection, upgradeAuthorityPubkey);
  
  // Verificar saldos
  const upgradeBalance = await connection.getBalance(upgradeAuthorityPubkey);
  const treasuryBalance = await connection.getBalance(treasury.publicKey);
  
  console.log(`Upgrade Authority: ${(upgradeBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  // STEP 2: Transferir SOL se necessário para upgrade
  const neededForUpgrade = 4.55;
  if (upgradeBalance < neededForUpgrade * LAMPORTS_PER_SOL) {
    const needed = neededForUpgrade * LAMPORTS_PER_SOL - upgradeBalance;
    const available = treasuryBalance - 1 * LAMPORTS_PER_SOL;
    
    if (available >= needed) {
      console.log(`💰 Transferindo ${(needed / LAMPORTS_PER_SOL).toFixed(4)} SOL para upgrade authority...`);
      await transferSol(treasury, upgradeAuthorityPubkey, needed / LAMPORTS_PER_SOL, connection);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // STEP 3: Fazer upgrade do programa
  console.log('='.repeat(60));
  const upgradeSuccess = await upgradeProgram(upgradeAuthorityPubkey);
  
  if (!upgradeSuccess) {
    console.log('⚠️  Upgrade não foi bem-sucedido. Continuando mesmo assim...\n');
  }
  
  // STEP 4: Carregar tokens
  console.log('='.repeat(60));
  console.log('STEP 4: Carregando tokens e criando pools\n');
  
  const tokensPath = process.env.TOKENS_CONFIG_PATH || 
    path.join(__dirname, '../config/devnet.tokens.json');
  const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  const tokens = tokensData.tokens || tokensData;
  
  const mintedTokens = tokens.filter((t: any) => 
    t.symbol !== 'SOL' && 
    t.symbol !== 'USDC' &&
    ['AEGIS', 'AERO', 'ABTC', 'AUSD', 'ASOL'].includes(t.symbol)
  );
  
  console.log(`📋 Tokens: ${mintedTokens.map((t: any) => t.symbol).join(', ')}\n`);
  
  // Setup Aegis client
  const wallet = new KeypairWallet(treasury);
  const aegis = new Aegis(connection, wallet as any, { programId: new PublicKey(PROGRAM_ID) });
  
  const feeBps = parseInt(process.env.FEE_BPS || '30');
  const liquidityAmount = parseFloat(process.env.INITIAL_LIQUIDITY_USD_EQUIV || '1000');
  
  const poolsOutput: any[] = [];
  let poolsCreated = 0;
  let poolsExisting = 0;
  let liquidityAdded = 0;
  
  // STEP 5: Criar pools uma por uma
  console.log('Criando pools token-token (10 pools):\n');
  
  for (let i = 0; i < mintedTokens.length; i++) {
    for (let j = i + 1; j < mintedTokens.length; j++) {
      const tokenA = mintedTokens[i];
      const tokenB = mintedTokens[j];
      
      const result = await createPoolWithLiquidity(
        aegis,
        connection,
        treasury,
        {
          mint: new PublicKey(tokenA.mint),
          symbol: tokenA.symbol,
          decimals: tokenA.decimals,
        },
        {
          mint: new PublicKey(tokenB.mint),
          symbol: tokenB.symbol,
          decimals: tokenB.decimals,
        },
        liquidityAmount,
        feeBps
      );
      
      if (result.success) {
        if (result.poolAddress) {
          const [mintA, mintB] = sortMints(
            new PublicKey(tokenA.mint),
            new PublicKey(tokenB.mint)
          );
          
          // Buscar informações da pool
          try {
            const pool = await aegis.getPool(mintA, mintB);
            if (pool) {
              poolsOutput.push({
                mintA: mintA.toString(),
                mintB: mintB.toString(),
                poolAddress: pool.info.address.toString(),
                vaultA: pool.info.vaultA.toString(),
                vaultB: pool.info.vaultB.toString(),
                lpMint: pool.info.lpMint.toString(),
                feeBps,
                decimalsA: tokenA.decimals,
                decimalsB: tokenB.decimals,
                timestamp: Date.now(),
              });
              
              if (result.poolAddress === pool.info.address.toString()) {
                poolsCreated++;
                liquidityAdded++;
              } else {
                poolsExisting++;
              }
            }
          } catch {}
        }
      }
      
      // Delay entre pools
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Salvar output
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
  console.log(`\n✅ Pools salvas em: ${poolsOutPath}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
