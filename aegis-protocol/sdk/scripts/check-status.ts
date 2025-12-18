#!/usr/bin/env ts-node
/**
 * Quick Status Check Script
 * 
 * Verifica rapidamente o status atual do projeto na devnet:
 * - Saldos das wallets principais
 * - Status do programa
 * - Pools criadas
 * - Tokens configurados
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.AEGIS_PROGRAM_ID || 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu';
const UPGRADE_AUTHORITY = 'EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z';
const TREASURY = '12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV';

const connection = new Connection(RPC_URL, 'confirmed');

async function getBalance(address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / 1e9; // Convert to SOL
  } catch (error) {
    console.error(`Erro ao verificar saldo de ${address}:`, error);
    return 0;
  }
}

async function getProgramInfo() {
  try {
    const programId = new PublicKey(PROGRAM_ID);
    const programInfo = await connection.getAccountInfo(programId);
    
    if (!programInfo) {
      return { deployed: false, dataLength: 0 };
    }

    // Get program data account
    const [programDataAddress] = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
    );

    const programDataInfo = await connection.getAccountInfo(programDataAddress);
    const dataLength = programDataInfo ? programDataInfo.data.length : 0;

    return {
      deployed: true,
      dataLength,
      programDataAddress: programDataAddress.toString(),
    };
  } catch (error) {
    return { deployed: false, error: String(error) };
  }
}

function getPoolsInfo() {
  const poolsPath = path.join(__dirname, '../config/devnet.pools.json');
  if (!fs.existsSync(poolsPath)) {
    return { exists: false, count: 0 };
  }

  try {
    const poolsData = JSON.parse(fs.readFileSync(poolsPath, 'utf-8'));
    const pools = poolsData.pools || [];
    return {
      exists: true,
      count: pools.length,
      pools: pools.map((p: any) => ({
        name: `${p.tokenA?.symbol || '?'}/${p.tokenB?.symbol || '?'}`,
        address: p.poolAddress,
      })),
    };
  } catch (error) {
    return { exists: true, count: 0, error: String(error) };
  }
}

function getTokensInfo() {
  const tokensPath = path.join(__dirname, '../config/devnet.tokens.json');
  if (!fs.existsSync(tokensPath)) {
    return { exists: false, count: 0 };
  }

  try {
    const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
    const tokens = tokensData.tokens || [];
    return {
      exists: true,
      count: tokens.length,
      tokens: tokens.map((t: any) => ({
        symbol: t.symbol,
        mint: t.mint,
      })),
    };
  } catch (error) {
    return { exists: true, count: 0, error: String(error) };
  }
}

function getWalletsInfo() {
  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../../local/wallets'), // aegis-protocol/local/wallets
    path.join(__dirname, '../../../local/wallets'), // local/wallets (from root)
  ];
  
  const walletsDir = possiblePaths.find(p => fs.existsSync(p));
  if (!walletsDir) {
    return { exists: false, count: 0 };
  }

  try {
    const files = fs.readdirSync(walletsDir);
    const walletFiles = files.filter(f => f.startsWith('wallet-') && f.endsWith('.json'));
    return {
      exists: true,
      count: walletFiles.length,
    };
  } catch (error) {
    return { exists: true, count: 0, error: String(error) };
  }
}

async function main() {
  console.log('\n🔍 VERIFICAÇÃO DE STATUS - AEGIS PROTOCOL DEVNET\n');
  console.log('=' .repeat(60));

  // Saldos
  console.log('\n💰 SALDOS:');
  console.log('-'.repeat(60));
  
  const upgradeBalance = await getBalance(UPGRADE_AUTHORITY);
  const treasuryBalance = await getBalance(TREASURY);
  
  console.log(`Upgrade Authority: ${upgradeBalance.toFixed(4)} SOL`);
  console.log(`  Status: ${upgradeBalance >= 4.5 ? '✅ Suficiente' : '⚠️  Precisa de ~' + (4.5 - upgradeBalance).toFixed(2) + ' SOL'}`);
  
  console.log(`Treasury:          ${treasuryBalance.toFixed(4)} SOL`);
  console.log(`  Status: ${treasuryBalance >= 6 ? '✅ Suficiente' : '⚠️  Precisa de ~' + (6 - treasuryBalance).toFixed(2) + ' SOL'}`);

  // Programa
  console.log('\n📦 PROGRAMA:');
  console.log('-'.repeat(60));
  const programInfo = await getProgramInfo();
  console.log(`Program ID: ${PROGRAM_ID}`);
  console.log(`Status: ${programInfo.deployed ? '✅ Deployado' : '❌ Não deployado'}`);
  if (programInfo.deployed) {
    console.log(`Data Length: ${programInfo.dataLength} bytes`);
    if (programInfo.programDataAddress) {
      console.log(`Program Data: ${programInfo.programDataAddress}`);
    }
  }

  // Pools
  console.log('\n🏊 POOLS:');
  console.log('-'.repeat(60));
  const poolsInfo = getPoolsInfo();
  if (poolsInfo.exists) {
    console.log(`Pools criadas: ${poolsInfo.count}`);
    if (poolsInfo.pools && poolsInfo.pools.length > 0) {
      poolsInfo.pools.forEach((p: any, i: number) => {
        console.log(`  ${i + 1}. ${p.name} - ${p.address}`);
      });
    }
  } else {
    console.log('Arquivo de pools não encontrado');
  }

  // Tokens
  console.log('\n🪙 TOKENS:');
  console.log('-'.repeat(60));
  const tokensInfo = getTokensInfo();
  if (tokensInfo.exists) {
    console.log(`Tokens configurados: ${tokensInfo.count}`);
    if (tokensInfo.tokens && tokensInfo.tokens.length > 0) {
      tokensInfo.tokens.forEach((t: any) => {
        console.log(`  - ${t.symbol}: ${t.mint}`);
      });
    }
  } else {
    console.log('Arquivo de tokens não encontrado');
  }

  // Wallets
  console.log('\n👛 WALLETS:');
  console.log('-'.repeat(60));
  const walletsInfo = getWalletsInfo();
  if (walletsInfo.exists) {
    console.log(`Wallets criadas: ${walletsInfo.count}`);
  } else {
    console.log('Diretório de wallets não encontrado');
  }

  // Resumo
  console.log('\n📊 RESUMO:');
  console.log('='.repeat(60));
  const canUpgrade = upgradeBalance >= 4.5;
  const canSetup = treasuryBalance >= 6;
  const hasPools = poolsInfo.count > 0;
  
  console.log(`Upgrade possível:     ${canUpgrade ? '✅ Sim' : '❌ Não (falta SOL)'}`);
  console.log(`Setup possível:       ${canSetup ? '✅ Sim' : '❌ Não (falta SOL)'}`);
  console.log(`Pools criadas:        ${hasPools ? '✅ Sim (' + poolsInfo.count + ')' : '❌ Não'}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📝 PRÓXIMOS PASSOS:');
  
  if (!canUpgrade) {
    console.log('1. ⚠️  Transferir SOL para upgrade authority');
    console.log(`   solana transfer ${UPGRADE_AUTHORITY} 3 --url devnet`);
    console.log(`   Ou usar faucet: https://faucet.solana.com`);
  }
  
  if (!canSetup) {
    console.log(`${canUpgrade ? '1' : '2'}. ⚠️  Transferir SOL para treasury`);
    console.log(`   solana transfer ${TREASURY} 6 --url devnet`);
    console.log(`   Ou usar faucet: https://faucet.solana.com`);
  }
  
  if (canUpgrade && canSetup && !hasPools) {
    console.log('1. ✅ Executar setup completo:');
    console.log('   cd aegis-protocol/sdk');
    console.log('   npx ts-node scripts/setup-complete-devnet.ts');
  }
  
  console.log('\n');
}

main().catch(console.error);
