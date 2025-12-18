#!/usr/bin/env ts-node
/**
 * MAXIMIZA POOLS COM SOL LIMITADO
 * 
 * Estratégia inteligente:
 * 1. Verifica todas as pools existentes
 * 2. Prioriza pools mais importantes (AEGIS/* primeiro)
 * 3. Cria pools token-token adicionais se houver SOL
 * 4. Garante liquidez mínima funcional em todas
 * 5. Usa SOL de forma eficiente (sem desperdício)
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
): Promise<{ exists: boolean; poolAddress?: PublicKey }> {
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), mintA.toBuffer(), mintB.toBuffer()],
    programId
  );
  
  try {
    const account = await connection.getAccountInfo(poolAddress);
    return { exists: account !== null, poolAddress };
  } catch {
    return { exists: false, poolAddress };
  }
}

async function getPoolInfo(
  connection: Connection,
  programId: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey
): Promise<{
  poolAddress: PublicKey;
  vaultA: PublicKey;
  vaultB: PublicKey;
  lpMint: PublicKey;
  liquidity: { amountA: BN; amountB: BN };
} | null> {
  try {
    const [poolAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), mintA.toBuffer(), mintB.toBuffer()],
      programId
    );
    const [vaultA] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_vault'), poolAddress.toBuffer(), mintA.toBuffer()],
      programId
    );
    const [vaultB] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_vault'), poolAddress.toBuffer(), mintB.toBuffer()],
      programId
    );
    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from('lp_mint'), poolAddress.toBuffer()],
      programId
    );

    let amountA = new BN(0);
    let amountB = new BN(0);
    try {
      const accountA = await getAccount(connection, vaultA);
      const accountB = await getAccount(connection, vaultB);
      amountA = new BN(accountA.amount.toString());
      amountB = new BN(accountB.amount.toString());
    } catch {}

    return { poolAddress, vaultA, vaultB, lpMint, liquidity: { amountA, amountB } };
  } catch {
    return null;
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
    return false;
  }
}

async function main() {
  console.log('\n🎯 MAXIMIZANDO POOLS COM SOL LIMITADO\n');
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

  if (solAvailable < 0.0005) {
    console.log('❌ SOL muito baixo (mínimo 0.0005 SOL para operações)');
    console.log('💡 Apenas verificando pools existentes...\n');
  }

  const treasuryWallet = new KeypairWallet(treasury);
  const aegis = new Aegis(connection, treasuryWallet, { programId });

  // Filtrar tokens AEGIS
  const aegisTokens = tokens.filter(t => 
    ['AEGIS', 'AERO', 'ABTC', 'AUSD', 'ASOL'].includes(t.symbol)
  );

  console.log(`📋 Tokens: ${aegisTokens.map(t => t.symbol).join(', ')}\n`);

  // Definir pares prioritários (AEGIS/* primeiro, depois token-token)
  const priorityPairs: Array<[string, string, number]> = [
    // Tier 1: AEGIS/* (mais importante)
    ['AEGIS', 'AERO', 1],
    ['AEGIS', 'ABTC', 1],
    ['AEGIS', 'AUSD', 1],
    ['AEGIS', 'ASOL', 1],
    // Tier 2: Token-token (importantes para swaps diretos)
    ['AERO', 'ABTC', 2],
    ['AERO', 'AUSD', 2],
    ['AERO', 'ASOL', 2],
    ['ABTC', 'AUSD', 2],
    ['ABTC', 'ASOL', 2],
    ['AUSD', 'ASOL', 2],
  ];

  const poolsOutput: any[] = [];
  let poolsWithLiquidity = 0;
  let poolsCreated = 0;
  const feeBps = parseInt(process.env.FEE_BPS || '30');
  const minLiquidity = new BN(100_000_000); // 100 tokens (6 decimals) - liquidez funcional

  console.log('🏊 Verificando e otimizando pools...\n');

  for (const [symbolA, symbolB, tier] of priorityPairs) {
    const tokenA = aegisTokens.find(t => t.symbol === symbolA);
    const tokenB = aegisTokens.find(t => t.symbol === symbolB);
    
    if (!tokenA || !tokenB) continue;

    const mintA = new PublicKey(tokenA.mint);
    const mintB = new PublicKey(tokenB.mint);
    const [sortedMintA, sortedMintB] = sortMints(mintA, mintB);

    const poolCheck = await checkPoolExists(connection, programId, sortedMintA, sortedMintB);
    const poolInfo = await getPoolInfo(connection, programId, sortedMintA, sortedMintB);
    
    if (!poolCheck.exists) {
      // Verificar SOL disponível
      const currentBalance = await connection.getBalance(treasury.publicKey);
      const solNeeded = 0.003; // ~0.003 SOL para criar pool
      
      if (currentBalance < solNeeded * LAMPORTS_PER_SOL) {
        console.log(`  ⏭️  ${symbolA}/${symbolB} (Tier ${tier}): SOL insuficiente (precisa ${solNeeded.toFixed(4)} SOL)`);
        continue;
      }

      try {
        console.log(`  🏊 Criando pool ${symbolA}/${symbolB} (Tier ${tier})...`);
        const pool = await Pool.create(aegis, sortedMintA, sortedMintB, feeBps, treasury);
        
        poolsOutput.push({
          mintA: sortedMintA.toString(),
          mintB: sortedMintB.toString(),
          poolAddress: pool.info.address.toString(),
          vaultA: pool.info.vaultA.toString(),
          vaultB: pool.info.vaultB.toString(),
          lpMint: pool.info.lpMint.toString(),
          feeBps,
          decimalsA: tokenA.decimals,
          decimalsB: tokenB.decimals,
          symbolA,
          symbolB,
          timestamp: Date.now(),
        });

        poolsCreated++;
        console.log(`    ✅ Pool criada: ${pool.info.address.toString()}`);
        
        // Tentar adicionar liquidez após criar
        await new Promise(resolve => setTimeout(resolve, 1500));
        const liquidityAdded = await addLiquidityToPool(
          aegis,
          pool,
          treasury,
          minLiquidity,
          minLiquidity
        );
        
        if (liquidityAdded) {
          poolsWithLiquidity++;
          console.log(`    💧 Liquidez adicionada (100 tokens cada)`);
        } else {
          console.log(`    ⚠️  Pool criada sem liquidez (sem tokens disponíveis)`);
        }
      } catch (error: any) {
        console.error(`    ❌ Erro: ${error.message}`);
      }
    } else {
      // Pool existe - verificar liquidez
      if (!poolInfo) continue;

      const tierLabel = tier === 1 ? 'Tier 1' : 'Tier 2';
      const hasLiquidity = poolInfo.liquidity.amountA.gte(minLiquidity) && 
                          poolInfo.liquidity.amountB.gte(minLiquidity);

      console.log(`  ✅ Pool ${symbolA}/${symbolB} (${tierLabel}) existe`);
      console.log(`    Liquidez: ${poolInfo.liquidity.amountA.toString()} / ${poolInfo.liquidity.amountB.toString()}`);

      if (hasLiquidity) {
        poolsWithLiquidity++;
        console.log(`    ✅ Liquidez suficiente`);
      } else {
        // Tentar adicionar liquidez se tiver tokens
        const currentBalance = await connection.getBalance(treasury.publicKey);
        if (currentBalance >= 0.0001 * LAMPORTS_PER_SOL) {
          const pool = new Pool(aegis, {
            address: poolInfo.poolAddress,
            mintA: sortedMintA,
            mintB: sortedMintB,
            vaultA: poolInfo.vaultA,
            vaultB: poolInfo.vaultB,
            lpMint: poolInfo.lpMint,
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
            console.log(`    💧 Liquidez adicionada`);
          } else {
            console.log(`    ⚠️  Sem tokens para adicionar liquidez`);
          }
        } else {
          console.log(`    ⚠️  Liquidez baixa e sem SOL para operações`);
        }
      }

      // Adicionar ao output
      poolsOutput.push({
        mintA: sortedMintA.toString(),
        mintB: sortedMintB.toString(),
        poolAddress: poolInfo.poolAddress.toString(),
        vaultA: poolInfo.vaultA.toString(),
        vaultB: poolInfo.vaultB.toString(),
        lpMint: poolInfo.lpMint.toString(),
        feeBps,
        decimalsA: tokenA.decimals,
        decimalsB: tokenB.decimals,
        symbolA,
        symbolB,
        timestamp: Date.now(),
      });
    }

    // Verificar saldo após cada operação
    const remainingBalance = await connection.getBalance(treasury.publicKey);
    if (remainingBalance < 0.0005 * LAMPORTS_PER_SOL) {
      console.log('\n⚠️  SOL muito baixo para continuar');
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
  console.log(`Pools com liquidez funcional: ${poolsWithLiquidity}`);
  console.log(`Total de pools registradas: ${poolsOutput.length}`);
  console.log(`SOL inicial: ${solAvailable.toFixed(6)} SOL`);
  console.log(`SOL final: ${finalSol.toFixed(6)} SOL`);
  console.log(`SOL usado: ${(solAvailable - finalSol).toFixed(6)} SOL`);
  console.log(`\n✅ Pools salvas em: ${poolsOutPath}`);
  console.log('='.repeat(60));
  
  // Estatísticas por tier
  const tier1Pools = poolsOutput.filter(p => 
    p.symbolA === 'AEGIS' || p.symbolB === 'AEGIS'
  );
  const tier2Pools = poolsOutput.filter(p => 
    p.symbolA !== 'AEGIS' && p.symbolB !== 'AEGIS'
  );
  
  console.log(`\n📈 Distribuição:`);
  console.log(`  Tier 1 (AEGIS/*): ${tier1Pools.length} pools`);
  console.log(`  Tier 2 (Token/Token): ${tier2Pools.length} pools`);
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
