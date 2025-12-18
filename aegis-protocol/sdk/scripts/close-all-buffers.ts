#!/usr/bin/env ts-node
import { Connection, PublicKey } from '@solana/web3.js';
import { execSync } from 'child_process';

const UPGRADE_AUTHORITY = 'EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z';
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🔍 Procurando buffers abertos...\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Get all program accounts owned by BPFLoaderUpgradeab1e11111111111111111111111
  // Buffers are owned by the upgradeable loader
  const upgradeableLoaderId = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
  
  try {
    const accounts = await connection.getProgramAccounts(upgradeableLoaderId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: [1], // Buffer account discriminator
          },
        },
      ],
    });
    
    console.log(`📦 Encontrados ${accounts.length} buffers\n`);
    
    if (accounts.length === 0) {
      console.log('✅ Nenhum buffer encontrado!');
      return;
    }
    
    let totalRecovered = 0;
    let closedCount = 0;
    
    for (const account of accounts) {
      const bufferAddress = account.pubkey.toString();
      
      // Check if this buffer belongs to our upgrade authority
      try {
        // Get account info to check authority
        const accountInfo = await connection.getAccountInfo(account.pubkey);
        if (!accountInfo) continue;
        
        // Try to close the buffer
        console.log(`🔒 Fechando buffer: ${bufferAddress}...`);
        
        try {
          const output = execSync(
            `solana program close ${bufferAddress} --url devnet 2>&1`,
            { encoding: 'utf-8' }
          );
          
          // Extract balance from output
          const balanceMatch = output.match(/Balance:\s*([\d.]+)\s*SOL/);
          if (balanceMatch) {
            const balance = parseFloat(balanceMatch[1]);
            totalRecovered += balance;
            closedCount++;
            console.log(`  ✅ Fechado! Recuperado: ${balance} SOL\n`);
          } else {
            console.log(`  ✅ Fechado!\n`);
            closedCount++;
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          const errorMsg = error.stdout || error.message || String(error);
          if (errorMsg.includes('Unable to find')) {
            console.log(`  ⏭️  Buffer já foi fechado ou não existe\n`);
          } else if (errorMsg.includes('authority')) {
            console.log(`  ⚠️  Buffer não pertence à upgrade authority\n`);
          } else {
            console.log(`  ❌ Erro: ${errorMsg.split('\n')[0]}\n`);
          }
        }
      } catch (error: any) {
        console.log(`  ❌ Erro ao processar: ${error.message}\n`);
      }
    }
    
    console.log('='.repeat(60));
    console.log(`📊 RESUMO`);
    console.log('='.repeat(60));
    console.log(`Buffers fechados: ${closedCount}`);
    console.log(`SOL recuperado: ~${totalRecovered.toFixed(4)} SOL`);
    
    // Check final balance
    const finalBalance = await connection.getBalance(new PublicKey(UPGRADE_AUTHORITY));
    console.log(`\n💰 Saldo final da upgrade authority: ${(finalBalance / 1e9).toFixed(4)} SOL`);
    
  } catch (error: any) {
    console.error('❌ Erro ao buscar buffers:', error.message);
  }
}

main().catch(console.error);
