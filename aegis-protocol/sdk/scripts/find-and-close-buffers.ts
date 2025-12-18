#!/usr/bin/env ts-node
/**
 * Find and close all program buffers for upgrade authority
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { execSync } from 'child_process';

const UPGRADE_AUTHORITY = 'EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z';
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('\n🔍 Procurando buffers da upgrade authority...\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const upgradeAuthority = new PublicKey(UPGRADE_AUTHORITY);
  
  // Buscar todas as contas de buffer (program data accounts)
  try {
    const accounts = await connection.getProgramAccounts(
      new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
      {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: upgradeAuthority.toBase58(),
            },
          },
        ],
      }
    );
    
    console.log(`Encontrados ${accounts.length} buffers potenciais\n`);
    
    let recovered = 0;
    for (const account of accounts) {
      try {
        const output = execSync(
          `solana program close ${account.pubkey.toString()} --url devnet 2>&1`,
          { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
        );
        
        if (output.includes('Balance:')) {
          const balanceMatch = output.match(/Balance: ([\d.]+) SOL/);
          if (balanceMatch) {
            const balance = parseFloat(balanceMatch[1]);
            console.log(`  ✅ ${account.pubkey.toString().substring(0, 16)}...: ${balance.toFixed(4)} SOL`);
            recovered += balance;
          }
        }
      } catch (error: any) {
        // Ignorar erros
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n💰 Total recuperado: ${recovered.toFixed(4)} SOL\n`);
  } catch (error: any) {
    console.log('⚠️  Erro ao buscar buffers:', error.message);
  }
  
  // Verificar saldo final
  const balance = await connection.getBalance(upgradeAuthority);
  console.log(`💰 Saldo final: ${(balance / 1e9).toFixed(4)} SOL\n`);
}

main().catch(console.error);
