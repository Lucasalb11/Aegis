#!/usr/bin/env ts-node
/**
 * FECHA TODOS OS BUFFERS E RECUPERA SOL IMEDIATAMENTE
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { execSync } from 'child_process';

const UPGRADE_AUTHORITY = 'EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z';
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
    return 0;
  } catch (error: any) {
    const errorMsg = error.stdout || error.message || String(error);
    if (errorMsg.includes('Unable to find') || errorMsg.includes('AccountNotFound')) {
      return 0; // Buffer já foi fechado
    }
    return 0;
  }
}

async function findAllBuffers(): Promise<string[]> {
  const buffers: string[] = [];
  const connection = new Connection(RPC_URL, 'confirmed');
  
  try {
    // Buscar buffers do BPFLoaderUpgradeab1e
    const accounts = await connection.getProgramAccounts(
      new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
      {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: [1], // Program data account
            },
          },
        ],
      }
    );
    
    for (const account of accounts) {
      try {
        const accountInfo = await connection.getAccountInfo(account.pubkey);
        if (accountInfo) {
          // Verificar se é um buffer (tem authority)
          const data = accountInfo.data;
          if (data.length > 45) {
            const authority = new PublicKey(data.slice(45, 77));
            if (authority.toBase58() === UPGRADE_AUTHORITY) {
              buffers.push(account.pubkey.toBase58());
            }
          }
        }
      } catch (e) {
        // Ignorar
      }
    }
  } catch (error) {
    console.log('⚠️  Erro ao buscar buffers:', error);
  }
  
  return buffers;
}

async function main() {
  console.log('\n🔍 FECHANDO TODOS OS BUFFERS E RECUPERANDO SOL\n');
  console.log('='.repeat(60));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const upgradeAuthority = new PublicKey(UPGRADE_AUTHORITY);
  
  // Saldo inicial
  const initialBalance = await connection.getBalance(upgradeAuthority);
  console.log(`💰 Saldo inicial: ${(initialBalance / 1e9).toFixed(4)} SOL\n`);
  
  // Lista de buffers conhecidos de tentativas anteriores
  const knownBuffers = [
    'H9R28fu1EVFwN4EAvT4N8R98E2FqHTCAHJCxvhbjzovi',
    'HBWnT4rg6ZdHuVNbWxByiy9tJgWvUrjE2yfvrnUtStca',
    '5n8FDjyeeDk1ts2qUEhVGuXSYtLD1aMm5Tco9nGWGRm3',
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
  let closedCount = 0;
  
  // Fechar buffers conhecidos
  console.log('📋 Fechando buffers conhecidos...\n');
  for (const buffer of knownBuffers) {
    const recovered = await closeBuffer(buffer);
    if (recovered > 0) {
      console.log(`  ✅ ${buffer.substring(0, 16)}...: ${recovered.toFixed(4)} SOL`);
      totalRecovered += recovered;
      closedCount++;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Buscar buffers adicionais
  console.log('\n🔍 Buscando buffers adicionais...\n');
  const foundBuffers = await findAllBuffers();
  
  for (const buffer of foundBuffers) {
    if (!knownBuffers.includes(buffer)) {
      const recovered = await closeBuffer(buffer);
      if (recovered > 0) {
        console.log(`  ✅ ${buffer.substring(0, 16)}...: ${recovered.toFixed(4)} SOL`);
        totalRecovered += recovered;
        closedCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  // Saldo final
  await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar confirmações
  const finalBalance = await connection.getBalance(upgradeAuthority);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO');
  console.log('='.repeat(60));
  console.log(`Buffers fechados: ${closedCount}`);
  console.log(`SOL recuperado: ${totalRecovered.toFixed(4)} SOL`);
  console.log(`Saldo inicial: ${(initialBalance / 1e9).toFixed(4)} SOL`);
  console.log(`Saldo final: ${(finalBalance / 1e9).toFixed(4)} SOL`);
  console.log(`Total disponível: ${(finalBalance / 1e9).toFixed(4)} SOL`);
  console.log('='.repeat(60));
  console.log('\n✅ Processo concluído!\n');
}

main().catch(console.error);
