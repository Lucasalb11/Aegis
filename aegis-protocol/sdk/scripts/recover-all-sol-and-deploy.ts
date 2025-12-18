#!/usr/bin/env ts-node
/**
 * Recover ALL SOL from buffers and temporary accounts
 * Concentrate in upgrade authority and deploy pools
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const UPGRADE_AUTHORITY = 'EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z';
const TREASURY = '12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV';
const PROGRAM_ID = 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu';
const RPC_URL = 'https://api.devnet.solana.com';

async function closeBuffer(bufferAddr: string): Promise<number> {
  try {
    const output = execSync(
      `solana program close ${bufferAddr} --url devnet 2>&1`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
    );
    
    if (output.includes('Balance:')) {
      const balanceMatch = output.match(/Balance: ([\d.]+) SOL/);
      if (balanceMatch) {
        return parseFloat(balanceMatch[1]);
      }
    }
  } catch (error: any) {
    // Ignorar erros
  }
  return 0;
}

async function main() {
  console.log('\n💰 RECUPERANDO SOL DE TODOS OS BUFFERS\n');
  console.log('='.repeat(60));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Lista completa de buffers conhecidos de todas as tentativas
  const allBuffers = [
    '5NxHvFJ6YzrWMy1ZufHipiqhGY22Y5aHEAith3BkWJ2v',
    'J4KLDzTc5LtAPzxon7eU7669EWpmzysSxeZ743rX5bvk',
    'DJHxg4ZH4XAhNhPYAAcqCm5741NMFwo5vf5FdFyKtHmd',
    'A58vpufAm48e5Zb1iL1MdkTxJmsw1C8tdUq58yDH1k5E',
    'BmrhB1KmqvHYze1ohDLZspEqw26RX7pZgAnmoPed2ixj',
    '3hLLV7zgvhVrsDnCrN81Dn3Bb4NabFLPJSq3wDrhZHbm',
    'DCULzpFyQj6X5G2Z8Yegr9TiL2LicHpATMFrVsaVE3Vx',
    'e2FhwUHQ3KkxzFJw26cZRxwfmqkG76U4r9YmssvkRYS',
    'D4XLggMaWGqyUANn4shEsy1bYX4fY5f6sDEsvH9gLU7E',
    '3R4W6oGKLgdKGpvo7X8yC6ojv88zEaod17iqaY1hDb8c',
    'EepiXNnKgafSFvzbV6cbmxXH3E136ftcfxCzG8HbCC8m',
    '529h9A3QCr9pgDvgRcGfxarBQMYiQ4QsC99F1W5PamYW',
    'Byk2ysBiJtGK8LTihZBJGNUuQvuAErAYVNiKv9f5YoWa',
  ];
  
  let totalRecovered = 0;
  
  console.log('Fechando buffers conhecidos...\n');
  for (const buffer of allBuffers) {
    const recovered = await closeBuffer(buffer);
    if (recovered > 0) {
      console.log(`  ✅ ${buffer.substring(0, 16)}...: ${recovered.toFixed(4)} SOL`);
      totalRecovered += recovered;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Buscar buffers via solana CLI
  console.log('\n🔍 Buscando buffers adicionais via solana program show...\n');
  try {
    const programInfo = execSync(
      `solana program show ${PROGRAM_ID} --url devnet 2>&1`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
    );
    
    // Extrair buffer addresses do output
    const bufferMatches = programInfo.match(/[A-Za-z0-9]{32,44}/g);
    if (bufferMatches) {
      for (const potentialBuffer of bufferMatches) {
        if (potentialBuffer.length === 44 && potentialBuffer !== PROGRAM_ID && potentialBuffer !== UPGRADE_AUTHORITY) {
          const recovered = await closeBuffer(potentialBuffer);
          if (recovered > 0) {
            console.log(`  ✅ ${potentialBuffer.substring(0, 16)}...: ${recovered.toFixed(4)} SOL`);
            totalRecovered += recovered;
          }
        }
      }
    }
  } catch (error) {
    // Ignorar erros
  }
  
  console.log(`\n💰 Total recuperado: ${totalRecovered.toFixed(4)} SOL\n`);
  
  // Verificar saldos
  const upgradeBalance = await connection.getBalance(new PublicKey(UPGRADE_AUTHORITY));
  const treasuryBalance = await connection.getBalance(new PublicKey(TREASURY));
  
  console.log('='.repeat(60));
  console.log('📊 SALDOS ATUAIS\n');
  console.log(`Upgrade Authority: ${(upgradeBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  // Verificar se precisa transferir mais SOL
  const neededForUpgrade = 4.55;
  if (upgradeBalance < neededForUpgrade * LAMPORTS_PER_SOL) {
    const needed = neededForUpgrade * LAMPORTS_PER_SOL - upgradeBalance;
    const available = treasuryBalance - 0.5 * LAMPORTS_PER_SOL; // Manter 0.5 SOL na treasury
    
    if (available >= needed) {
      console.log(`💰 Transferindo ${(needed / LAMPORTS_PER_SOL).toFixed(4)} SOL da treasury para upgrade authority...\n`);
      try {
        execSync(
          `solana transfer --from ${path.join(__dirname, '../../../.secrets/devnet/treasury.json')} ${UPGRADE_AUTHORITY} ${(needed / LAMPORTS_PER_SOL).toFixed(4)} --url devnet --allow-unfunded-recipient`,
          { stdio: 'inherit' }
        );
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.log('⚠️  Erro ao transferir. Tente manualmente.\n');
      }
    } else {
      console.log(`⚠️  SOL insuficiente. Precisa ${(needed / LAMPORTS_PER_SOL).toFixed(4)} SOL, disponível ${(available / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
      console.log('💡 Opções:');
      console.log(`   1. Transferir de outra wallet: solana transfer ${UPGRADE_AUTHORITY} ${(needed / LAMPORTS_PER_SOL).toFixed(2)} --url devnet`);
      console.log(`   2. Usar faucet web: https://faucet.solana.com (endereço: ${UPGRADE_AUTHORITY})\n`);
    }
  }
  
  // Verificar saldo final
  const finalBalance = await connection.getBalance(new PublicKey(UPGRADE_AUTHORITY));
  console.log(`💰 Saldo final da upgrade authority: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  if (finalBalance >= neededForUpgrade * LAMPORTS_PER_SOL) {
    console.log('='.repeat(60));
    console.log('🚀 FAZENDO UPGRADE DO PROGRAMA\n');
    
    const programDir = path.join(__dirname, '../../program');
    const soPath = path.join(programDir, 'target/deploy/aegis_protocol.so');
    
    try {
      const output = execSync(
        `solana program deploy ${soPath} --program-id ${PROGRAM_ID} --url devnet --upgrade-authority /Users/lucas/.config/solana/id.json 2>&1`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, stdio: 'pipe' }
      );
      
      if (output.includes('Program Id:') || output.includes('Deploy success')) {
        console.log('✅ UPGRADE BEM-SUCEDIDO!\n');
        
        console.log('='.repeat(60));
        console.log('🏊 CRIANDO POOLS AGORA...\n');
        
        // Executar script de criação de pools
        execSync(
          `AEGIS_PROGRAM_ID=${PROGRAM_ID} INITIAL_LIQUIDITY_USD_EQUIV=1000 INITIAL_SOL_PER_WALLET=0.1 INITIAL_TOKEN_PER_WALLET=10000 npx ts-node scripts/recover-and-setup-pools.ts`,
          { 
            cwd: __dirname,
            stdio: 'inherit',
            env: { ...process.env }
          }
        );
      } else {
        console.log('⚠️  Upgrade pode ter falhado. Verifique manualmente.\n');
      }
    } catch (error: any) {
      const errorMsg = error.stdout || error.message || String(error);
      if (errorMsg.includes('insufficient funds')) {
        console.log('⚠️  SOL ainda insuficiente após recuperação.\n');
      } else if (errorMsg.includes('write transactions failed')) {
        console.log('⚠️  Problemas de rede. Aguarde e tente novamente.\n');
      } else {
        console.log(`⚠️  Erro: ${errorMsg.split('\n')[0]}\n`);
      }
    }
  } else {
    console.log('⚠️  SOL insuficiente para upgrade. Transfira mais SOL e execute novamente.\n');
  }
}

main().catch(console.error);
