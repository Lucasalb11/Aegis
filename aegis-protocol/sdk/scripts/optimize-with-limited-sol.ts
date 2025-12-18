#!/usr/bin/env ts-node
/**
 * Optimized Script for Maximum Utilization of Limited SOL
 * 
 * Strategy:
 * 1. Check existing pools and add liquidity where needed
 * 2. Prioritize AEGIS/* pools (most important)
 * 3. Use SOL efficiently (no waste)
 * 4. Ensure pools have minimum functional liquidity
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import BN from 'bn.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Aegis } from '../src/aegis';
import { Pool } from '../src/pool';

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
  async signTransaction(tx: any): Promise<any> {
    tx.partialSign(this.keypair);
    return tx;
  }
  async signAllTransactions(txs: any[]): Promise<any[]> {
    return txs.map(tx => {
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

async function getPoolLiquidity(
  connection: Connection,
  poolAddress: PublicKey,
  vaultA: PublicKey,
  vaultB: PublicKey
): Promise<{ amountA: BN; amountB: BN }> {
  try {
    const accountA = await getAccount(connection, vaultA);
    const accountB = await getAccount(connection, vaultB);
    return {
      amountA: new BN(accountA.amount.toString()),
      amountB: new BN(accountB.amount.toString()),
    };
  } catch {
    return { amountA: new BN(0), amountB: new BN(0) };
  }
}

async function addLiquidityToPool(
  aegis: Aegis,
  pool: Pool,
  treasury: Keypair,
  amountA: BN,
  amountB: BN
): Promise<boolean> {
  try {
    const treasuryATA_A = await getOrCreateAssociatedTokenAccount(
      aegis.connection,
      treasury,
      pool.info.mintA,
      treasury.publicKey
    );
    const treasuryATA_B = await getOrCreateAssociatedTokenAccount(
      aegis.connection,
      treasury,
      pool.info.mintB,
      treasury.publicKey
    );
    const treasuryLP = await getOrCreateAssociatedTokenAccount(
      aegis.connection,
      treasury,
      pool.info.lpMint,
      treasury.publicKey
    );

    const balanceA = await getAccount(aegis.connection, treasuryATA_A.address).catch(() => null);
    const balanceB = await getAccount(aegis.connection, treasuryATA_B.address).catch(() => null);

    if (!balanceA || new BN(balanceA.amount.toString()).lt(amountA)) {
      return false;
    }
    if (!balanceB || new BN(balanceB.amount.toString()).lt(amountB)) {
      return false;
    }

    const treasuryWallet = new KeypairWallet(treasury);
    const aegisWithTreasury = new Aegis(aegis.connection, treasuryWallet, { programId: aegis.programId });
    const poolWithTreasury = new Pool(aegisWithTreasury, pool.info);

    await poolWithTreasury.addLiquidity(
      { amountA, amountB },
      treasuryATA_A.address,
      treasuryATA_B.address,
      treasuryLP.address
    );

    return true;
  } catch (error: any) {
    console.error(`    ❌ Erro: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 OTIMIZAÇÃO COM SOL LIMITADO\n');
  console.log('='.repeat(60));

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const programId = new PublicKey(
    process.env.AEGIS_PROGRAM_ID || 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu'
  );
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || 
    path.join(__dirname, '../../.secrets/devnet/treasury.json');
  const tokensConfigPath = process.env.TOKENS_CONFIG_PATH || 
    path.join(__dirname, '../config/devnet.tokens.json');
  const poolsOutPath = process.env.POOLS_OUT_PATH || 
    path.join(__dirname, '../config/devnet.pools.json');

  const connection = new Connection(rpcUrl, 'confirmed');
  const treasury = loadKeypair(treasuryPath);
  const tokens = await loadTokensConfig();

  console.log(`🔗 RPC: ${rpcUrl}`);
  console.log(`📦 Program ID: ${programId.toString()}`);
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);

  const balance = await connection.getBalance(treasury.publicKey);
  const solAvailable = balance / LAMPORTS_PER_SOL;
  console.log(`💰 Balance: ${solAvailable.toFixed(6)} SOL\n`);

  if (solAvailable < 0.001) {
    console.log('❌ SOL insuficiente para operações (mínimo 0.001 SOL)');
    return;
  }

  const treasuryWallet = new KeypairWallet(treasury);
  const aegis = new Aegis(connection, treasuryWallet, { programId });

  // Filter only AEGIS tokens (not SOL, USDC)
  const aegisTokens = tokens.filter(t => 
    t.symbol !== 'SOL' && 
    t.symbol !== 'USDC' && 
    ['AEGIS', 'AERO', 'ABTC', 'AUSD', 'ASOL'].includes(t.symbol)
  );

  const aegisToken = aegisTokens.find(t => t.symbol === 'AEGIS');
  if (!aegisToken) {
    console.log('❌ AEGIS token not found');
    return;
  }

  const aegisMint = new PublicKey(aegisToken.mint);
  const otherTokens = aegisTokens.filter(t => t.symbol !== 'AEGIS');

  console.log(`📋 Available tokens: ${aegisTokens.map(t => t.symbol).join(', ')}\n`);

  // Priority: AEGIS/* pools are most important
  const priorityPairs: Array<[string, string]> = [
    ['AEGIS', 'AERO'],
    ['AEGIS', 'ABTC'],
    ['AEGIS', 'AUSD'],
    ['AEGIS', 'ASOL'],
  ];

  const poolsOutput: any[] = [];
  let poolsWithLiquidity = 0;
  let poolsCreated = 0;
  const feeBps = parseInt(process.env.FEE_BPS || '30');
  const minLiquidity = new BN(100_000); // 0.1 tokens (6 decimals)

  console.log('🏊 Verificando e otimizando pools...\n');

  for (const [symbolA, symbolB] of priorityPairs) {
    const tokenA = aegisTokens.find(t => t.symbol === symbolA);
    const tokenB = aegisTokens.find(t => t.symbol === symbolB);
    
    if (!tokenA || !tokenB) continue;

    const mintA = new PublicKey(tokenA.mint);
    const mintB = new PublicKey(tokenB.mint);
    const [sortedMintA, sortedMintB] = sortMints(mintA, mintB);

    const poolExists = await checkPoolExists(connection, programId, sortedMintA, sortedMintB);
    
    if (!poolExists) {
      // Verificar se temos SOL suficiente para criar pool (~0.003 SOL)
      const currentBalance = await connection.getBalance(treasury.publicKey);
      if (currentBalance < 0.003 * LAMPORTS_PER_SOL) {
        console.log(`  ⚠️  ${symbolA}/${symbolB}: SOL insuficiente para criar pool`);
        continue;
      }

      try {
        console.log(`  🏊 Criando pool ${symbolA}/${symbolB}...`);
        const pool = await Pool.create(aegis, sortedMintA, sortedMintB, feeBps, treasury);
        
        const [poolAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool'), sortedMintA.toBuffer(), sortedMintB.toBuffer()],
          programId
        );
        const [vaultA] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool_vault'), poolAddress.toBuffer(), sortedMintA.toBuffer()],
          programId
        );
        const [vaultB] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool_vault'), poolAddress.toBuffer(), sortedMintB.toBuffer()],
          programId
        );
        const [lpMint] = PublicKey.findProgramAddressSync(
          [Buffer.from('lp_mint'), poolAddress.toBuffer()],
          programId
        );

        poolsOutput.push({
          mintA: sortedMintA.toString(),
          mintB: sortedMintB.toString(),
          poolAddress: poolAddress.toString(),
          vaultA: vaultA.toString(),
          vaultB: vaultB.toString(),
          lpMint: lpMint.toString(),
          feeBps,
          decimalsA: tokenA.decimals,
          decimalsB: tokenB.decimals,
          symbolA,
          symbolB,
          timestamp: Date.now(),
        });

        poolsCreated++;
        console.log(`    ✅ Pool criada: ${poolAddress.toString()}`);
        
        // Try to add minimum liquidity
        await new Promise(resolve => setTimeout(resolve, 1000));
        const liquidityAdded = await addLiquidityToPool(
          aegis,
          pool,
          treasury,
          minLiquidity,
          minLiquidity
        );
        
        if (liquidityAdded) {
          poolsWithLiquidity++;
          console.log(`    💧 Minimum liquidity added`);
        } else {
          console.log(`    ⚠️  No tokens for liquidity (pool created empty)`);
        }
      } catch (error: any) {
        console.error(`    ❌ Erro: ${error.message}`);
      }
    } else {
      // Pool exists - check and add liquidity if needed
      try {
        const [poolAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool'), sortedMintA.toBuffer(), sortedMintB.toBuffer()],
          programId
        );
        const [vaultA] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool_vault'), poolAddress.toBuffer(), sortedMintA.toBuffer()],
          programId
        );
        const [vaultB] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool_vault'), poolAddress.toBuffer(), sortedMintB.toBuffer()],
          programId
        );
        const [lpMint] = PublicKey.findProgramAddressSync(
          [Buffer.from('lp_mint'), poolAddress.toBuffer()],
          programId
        );

        const liquidity = await getPoolLiquidity(connection, poolAddress, vaultA, vaultB);
        
        console.log(`  ✅ Pool ${symbolA}/${symbolB} exists`);
        console.log(`    Liquidity: ${liquidity.amountA.toString()} / ${liquidity.amountB.toString()}`);

        // If liquidity is too low, try to add
        if (liquidity.amountA.lt(minLiquidity) || liquidity.amountB.lt(minLiquidity)) {
          const pool = new Pool(aegis, {
            address: poolAddress,
            mintA: sortedMintA,
            mintB: sortedMintB,
            vaultA,
            vaultB,
            lpMint,
            feeBps,
            lpSupply: new BN(0),
            creator: treasury.publicKey,
          });

          const liquidityAdded = await addLiquidityToPool(
            aegis,
            pool,
            treasury,
            minLiquidity,
            minLiquidity
          );

          if (liquidityAdded) {
            poolsWithLiquidity++;
            console.log(`    💧 Liquidity added`);
          } else {
            console.log(`    ⚠️  No tokens to add liquidity`);
          }
        } else {
          poolsWithLiquidity++;
          console.log(`    ✅ Sufficient liquidity`);
        }

        // Add to output if not already there
        const existsInOutput = poolsOutput.some(p => 
          p.poolAddress === poolAddress.toString()
        );
        if (!existsInOutput) {
          poolsOutput.push({
            mintA: sortedMintA.toString(),
            mintB: sortedMintB.toString(),
            poolAddress: poolAddress.toString(),
            vaultA: vaultA.toString(),
            vaultB: vaultB.toString(),
            lpMint: lpMint.toString(),
            feeBps,
            decimalsA: tokenA.decimals,
            decimalsB: tokenB.decimals,
            symbolA,
            symbolB,
            timestamp: Date.now(),
          });
        }
      } catch (error: any) {
        console.error(`    ❌ Erro ao verificar pool: ${error.message}`);
      }
    }

    // Check balance after each operation
    const remainingBalance = await connection.getBalance(treasury.publicKey);
    if (remainingBalance < 0.001 * LAMPORTS_PER_SOL) {
      console.log('\n⚠️  SOL insuficiente para continuar');
      break;
    }
  }

  // Salvar pools
  fs.writeFileSync(poolsOutPath, JSON.stringify({
    pools: poolsOutput,
    createdAt: Date.now(),
  }, null, 2));

  const finalBalance = await connection.getBalance(treasury.publicKey);
  const finalSol = finalBalance / LAMPORTS_PER_SOL;

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Pools criadas nesta execução: ${poolsCreated}`);
  console.log(`Pools com liquidez: ${poolsWithLiquidity}`);
  console.log(`Total de pools: ${poolsOutput.length}`);
  console.log(`SOL inicial: ${solAvailable.toFixed(6)} SOL`);
  console.log(`SOL final: ${finalSol.toFixed(6)} SOL`);
  console.log(`SOL usado: ${(solAvailable - finalSol).toFixed(6)} SOL`);
  console.log(`\n✅ Pools salvas em: ${poolsOutPath}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
