#!/usr/bin/env ts-node
/**
 * Fund Treasury and Setup Complete Devnet
 * 
 * Verifica saldos, transfere SOL se necessário, solicita airdrop se faltar,
 * e executa o setup completo
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

const envPath = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../.env.local'),
].find(p => fs.existsSync(p)) || path.join(__dirname, '../.env.local');

dotenv.config({ path: envPath });

const TREASURY_ADDRESS = '12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV';
const UPGRADE_AUTHORITY = 'EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z';
const MIN_TREASURY_BALANCE = 15 * LAMPORTS_PER_SOL; // 15 SOL mínimo
const RPC_URL = 'https://api.devnet.solana.com';

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function requestAirdrop(connection: Connection, address: PublicKey, amount: number): Promise<string> {
  console.log(`🪂 Solicitando airdrop de ${amount} SOL para ${address.toString()}...`);
  const signature = await connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature);
  console.log(`✅ Airdrop recebido! Signature: ${signature}`);
  return signature;
}

async function transferSol(from: Keypair, to: PublicKey, amount: number, connection: Connection): Promise<string> {
  console.log(`💰 Transferindo ${amount} SOL de ${from.publicKey.toString()} para ${to.toString()}...`);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );
  const signature = await connection.sendTransaction(tx, [from]);
  await connection.confirmTransaction(signature);
  console.log(`✅ Transferência concluída! Signature: ${signature}`);
  return signature;
}

async function main() {
  console.log('\n🚀 Aegis Protocol - Fund & Setup\n');
  console.log('='.repeat(60));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
  const upgradeAuthorityPubkey = new PublicKey(UPGRADE_AUTHORITY);
  
  // Verificar saldo da treasury
  console.log('\n📊 Verificando saldos...\n');
  const treasuryBalance = await connection.getBalance(treasuryPubkey);
  const upgradeBalance = await connection.getBalance(upgradeAuthorityPubkey);
  
  console.log(`Treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Upgrade Authority: ${(upgradeBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  // Verificar se precisa de mais SOL
  if (treasuryBalance < MIN_TREASURY_BALANCE) {
    const needed = MIN_TREASURY_BALANCE - treasuryBalance;
    const neededSol = needed / LAMPORTS_PER_SOL;
    
    console.log(`⚠️  Treasury precisa de mais ${neededSol.toFixed(4)} SOL\n`);
    
    // Tentar transferir da upgrade authority primeiro
    if (upgradeBalance > needed + 0.1 * LAMPORTS_PER_SOL) {
      try {
        // Tentar carregar upgrade authority keypair
        const upgradeKeypairPath = '/Users/lucas/.config/solana/id.json';
        if (fs.existsSync(upgradeKeypairPath)) {
          const upgradeKeypair = loadKeypair(upgradeKeypairPath);
          await transferSol(upgradeKeypair, treasuryPubkey, neededSol, connection);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log('⚠️  Upgrade authority keypair não encontrado, usando airdrop...\n');
          throw new Error('Keypair not found');
        }
      } catch (error: any) {
        console.log(`⚠️  Erro ao transferir da upgrade authority: ${error.message}\n`);
        console.log('🪂 Tentando airdrop direto na treasury...\n');
        
        // Solicitar airdrop
        try {
          await requestAirdrop(connection, treasuryPubkey, neededSol);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (airdropError: any) {
          console.error(`❌ Erro no airdrop: ${airdropError.message}`);
          console.log('\n💡 Tente solicitar airdrop manualmente:');
          console.log(`solana airdrop ${neededSol.toFixed(2)} ${TREASURY_ADDRESS} --url devnet\n`);
          process.exit(1);
        }
      }
    } else {
      // Upgrade authority não tem suficiente, solicitar airdrop
      console.log('🪂 Solicitando airdrop para treasury...\n');
      try {
        await requestAirdrop(connection, treasuryPubkey, neededSol);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error: any) {
        console.error(`❌ Erro no airdrop: ${error.message}`);
        console.log('\n💡 Tente solicitar airdrop manualmente:');
        console.log(`solana airdrop ${neededSol.toFixed(2)} ${TREASURY_ADDRESS} --url devnet\n`);
        process.exit(1);
      }
    }
    
    // Verificar saldo final
    const finalBalance = await connection.getBalance(treasuryPubkey);
    console.log(`\n✅ Saldo final da treasury: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  } else {
    console.log(`✅ Treasury tem SOL suficiente: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  }
  
  // Executar setup completo
  console.log('='.repeat(60));
  console.log('🚀 Executando setup completo...\n');
  
  try {
    execSync(
      `AEGIS_PROGRAM_ID=AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu INITIAL_LIQUIDITY_USD_EQUIV=1000 INITIAL_SOL_PER_WALLET=0.1 INITIAL_TOKEN_PER_WALLET=10000 npx ts-node scripts/setup-complete-devnet.ts`,
      { 
        cwd: __dirname,
        stdio: 'inherit',
        env: { ...process.env }
      }
    );
  } catch (error) {
    console.error('\n❌ Erro ao executar setup completo');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
