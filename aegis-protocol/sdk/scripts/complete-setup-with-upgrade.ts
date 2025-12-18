#!/usr/bin/env ts-node
/**
 * Complete Setup with Upgrade Attempt
 * 
 * Tenta fazer upgrade do programa e depois cria todas as pools
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPath = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../.env.local'),
].find(p => fs.existsSync(p)) || path.join(__dirname, '../.env.local');

dotenv.config({ path: envPath });

const UPGRADE_AUTHORITY = 'EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z';
const PROGRAM_ID = 'AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu';
const TREASURY = '12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV';

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function transferSol(from: Keypair, to: PublicKey, amount: number, connection: Connection) {
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

async function main() {
  console.log('\n🚀 Aegis Protocol - Complete Setup\n');
  console.log('='.repeat(60));
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const upgradeAuthority = new PublicKey(UPGRADE_AUTHORITY);
  const treasuryPath = path.join(__dirname, '../../../.secrets/devnet/treasury.json');
  const treasury = loadKeypair(treasuryPath);
  
  // STEP 1: Verificar saldos e transferir SOL se necessário
  console.log('STEP 1: Verificando saldos...\n');
  
  const upgradeBalance = await connection.getBalance(upgradeAuthority);
  const treasuryBalance = await connection.getBalance(treasury.publicKey);
  
  console.log(`Upgrade authority: ${(upgradeBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
  
  const neededForUpgrade = 4.55;
  if (upgradeBalance < neededForUpgrade * LAMPORTS_PER_SOL) {
    const needed = neededForUpgrade * LAMPORTS_PER_SOL - upgradeBalance;
    const available = treasuryBalance - 1 * LAMPORTS_PER_SOL; // Keep 1 SOL in treasury
    
    if (available >= needed) {
      console.log(`💰 Transferindo ${(needed / LAMPORTS_PER_SOL).toFixed(4)} SOL para upgrade authority...`);
      await transferSol(treasury, upgradeAuthority, needed / LAMPORTS_PER_SOL, connection);
      console.log(`✅ Transferência concluída\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log(`⚠️  SOL insuficiente na treasury para upgrade`);
      console.log(`   Precisa: ${(needed / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      console.log(`   Disponível: ${(available / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
    }
  }
  
  // STEP 2: Tentar fazer upgrade
  console.log('='.repeat(60));
  console.log('STEP 2: Tentando fazer upgrade do programa...\n');
  
  const programDir = path.join(__dirname, '../../program');
  const soPath = path.join(programDir, 'target/deploy/aegis_protocol.so');
  
  if (!fs.existsSync(soPath)) {
    console.log('⚠️  Arquivo .so não encontrado. Compilando programa...\n');
    try {
      execSync('anchor build', { cwd: programDir, stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Erro ao compilar programa');
      return;
    }
  }
  
  console.log('🔄 Tentando fazer upgrade...');
  try {
    const output = execSync(
      `solana program deploy ${soPath} --program-id ${PROGRAM_ID} --url devnet --upgrade-authority /Users/lucas/.config/solana/id.json 2>&1`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    if (output.includes('Program Id:') || output.includes('Deploy success')) {
      console.log('✅ Upgrade bem-sucedido!\n');
    } else if (output.includes('insufficient funds')) {
      console.log('⚠️  SOL insuficiente para upgrade. Continuando sem upgrade...\n');
    } else if (output.includes('write transactions failed')) {
      console.log('⚠️  Problemas de rede na devnet. Tentando novamente...\n');
      // Try once more
      await new Promise(resolve => setTimeout(resolve, 10000));
      try {
        const retryOutput = execSync(
          `solana program deploy ${soPath} --program-id ${PROGRAM_ID} --url devnet --upgrade-authority /Users/lucas/.config/solana/id.json 2>&1`,
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
        if (retryOutput.includes('Program Id:') || retryOutput.includes('Deploy success')) {
          console.log('✅ Upgrade bem-sucedido na segunda tentativa!\n');
        } else {
          console.log('⚠️  Upgrade ainda falhando. Continuando sem upgrade...\n');
        }
      } catch {}
    } else {
      console.log('⚠️  Upgrade falhou. Continuando sem upgrade...\n');
    }
  } catch (error: any) {
    const errorMsg = error.stdout || error.message || String(error);
    if (errorMsg.includes('insufficient funds')) {
      console.log('⚠️  SOL insuficiente para upgrade\n');
    } else if (errorMsg.includes('write transactions failed')) {
      console.log('⚠️  Problemas de rede. Continuando sem upgrade...\n');
    } else {
      console.log(`⚠️  Erro no upgrade: ${errorMsg.split('\n')[0]}\n`);
    }
  }
  
  // STEP 3: Executar setup completo
  console.log('='.repeat(60));
  console.log('STEP 3: Executando setup completo de pools...\n');
  
  try {
    execSync(
      `AEGIS_PROGRAM_ID=${PROGRAM_ID} npx ts-node scripts/setup-complete-devnet.ts`,
      { cwd: __dirname, stdio: 'inherit' }
    );
  } catch (error) {
    console.error('\n❌ Erro ao executar setup completo');
  }
}

main().catch(console.error);
