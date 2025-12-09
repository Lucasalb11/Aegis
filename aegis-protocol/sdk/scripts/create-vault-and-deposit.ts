#!/usr/bin/env tsx

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AegisClient, PolicyConfig } from '../src';
import { solToLamports } from '../src/types';

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || 'Aegis111111111111111111111111111111111111111');

/**
 * Example script: Create a vault and deposit SOL
 */
async function main() {
  try {
    console.log('🚀 Aegis Protocol - Create Vault and Deposit Example\n');

    // Initialize connection and wallet
    const connection = new Connection(RPC_URL, 'confirmed');
    const wallet = Keypair.generate(); // In production, use a real wallet

    console.log('📡 Connecting to:', RPC_URL);
    console.log('👤 Wallet:', wallet.publicKey.toString());

    // Request airdrop for testing (devnet only)
    console.log('\n💰 Requesting airdrop...');
    const airdropSignature = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature);
    console.log('✅ Airdrop confirmed');

    // Initialize Aegis client
    const aegis = AegisClient.initAegisClient(connection, wallet, PROGRAM_ID);

    // Set up event listeners
    aegis.on('vaultCreated', (data) => {
      console.log('🏦 Vault created:', data.vault.toString());
      console.log('📋 Policy created:', data.policy.toString());
    });

    aegis.on('solDeposited', (data) => {
      console.log('💰 SOL deposited:', solToLamports(data.amount.toNumber()).toString(), 'SOL');
    });

    // Create vault with policy
    console.log('\n🏗️  Creating vault...');
    const policyConfig: PolicyConfig = {
      dailySpendLimitLamports: solToLamports(10), // 10 SOL daily limit
      largeTxThresholdLamports: solToLamports(2),  // 2 SOL large transaction threshold
    };

    const { vault, policy, txSignature: vaultTx } = await aegis.createVault(policyConfig);
    console.log('✅ Vault creation tx:', vaultTx);

    // Deposit SOL into vault
    console.log('\n💸 Depositing 1 SOL into vault...');
    const depositAmount = 1.0; // 1 SOL
    const depositTx = await aegis.depositSol(vault, depositAmount);
    console.log('✅ Deposit tx:', depositTx);

    // Get vault info
    console.log('\n📊 Vault info:');
    const vaultInfo = await aegis.getVault(vault);
    console.log('- Balance:', solToLamports(vaultInfo.balance.toNumber()).toString(), 'SOL');
    console.log('- Daily spent:', solToLamports(vaultInfo.dailySpent.toNumber()).toString(), 'SOL');
    console.log('- Is active:', vaultInfo.isActive);

    console.log('\n🎉 Example completed successfully!');
    console.log('🏦 Vault address:', vault.toString());
    console.log('📋 Policy address:', policy.toString());

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the example
main();
