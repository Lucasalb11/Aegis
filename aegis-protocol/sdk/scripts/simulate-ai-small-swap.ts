#!/usr/bin/env tsx

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AegisClient, PolicyConfig, SwapRequestParams } from '../src';
import { solToLamports, WSOL_MINT, USDC_MINT } from '../src/types';

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || 'Aegis111111111111111111111111111111111111111');

/**
 * Example script: Simulate AI agent making a small swap (under threshold)
 */
async function main() {
  try {
    console.log('🤖 Aegis Protocol - AI Small Swap Simulation\n');

    // Initialize connection and wallet
    const connection = new Connection(RPC_URL, 'confirmed');
    const aiWallet = Keypair.generate(); // AI agent's wallet

    console.log('📡 Connecting to:', RPC_URL);
    console.log('🤖 AI Wallet:', aiWallet.publicKey.toString());

    // Request airdrop for testing (devnet only)
    console.log('\n💰 Requesting airdrop for AI wallet...');
    const airdropSignature = await connection.requestAirdrop(aiWallet.publicKey, 3 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature);
    console.log('✅ Airdrop confirmed');

    // Initialize Aegis client with AI wallet
    const aegis = AegisClient.initAegisClient(connection, aiWallet, PROGRAM_ID);

    // Set up event listeners
    aegis.on('vaultCreated', (data) => {
      console.log('🏦 Vault created for AI agent:', data.vault.toString());
    });

    aegis.on('solDeposited', (data) => {
      console.log('💰 SOL deposited to AI vault:', solToLamports(data.amount.toNumber()).toString(), 'SOL');
    });

    aegis.on('swapExecuted', (data) => {
      console.log('🔄 Swap executed immediately:');
      console.log('  - Amount in:', solToLamports(data.amountIn.toNumber()).toString(), 'SOL');
      console.log('  - Min amount out:', solToLamports(data.amountOutMin.toNumber()).toString(), 'USDC');
    });

    // Step 1: Create vault for AI agent
    console.log('\n🤖 AI Agent: Creating secure vault...');
    const policyConfig: PolicyConfig = {
      dailySpendLimitLamports: solToLamports(5),   // 5 SOL daily limit
      largeTxThresholdLamports: solToLamports(1),   // 1 SOL large transaction threshold
    };

    const { vault: aiVault } = await aegis.createVault(policyConfig);
    console.log('✅ AI vault created');

    // Step 2: Deposit SOL into AI vault
    console.log('\n🤖 AI Agent: Funding vault with 2 SOL...');
    await aegis.depositSol(aiVault, 2.0);
    console.log('✅ AI vault funded');

    // Step 3: AI agent makes a small swap (under threshold)
    console.log('\n🤖 AI Agent: Executing small trade (0.5 SOL -> USDC)...');

    // In a real scenario, you would:
    // 1. Get a Jupiter quote
    // 2. Serialize the route data
    // 3. Pass it to the requestSwap function
    // For this example, we'll use placeholder data

    const swapParams: SwapRequestParams = {
      vaultPubkey: aiVault,
      amount: solToLamports(0.5),        // 0.5 SOL
      fromMint: WSOL_MINT,               // wSOL
      toMint: USDC_MINT,                 // USDC
      amountOutMin: new solToLamports(0.45), // Minimum 0.45 USDC (accounting for slippage)
      // jupiterRoute: jupiterQuote,     // Would come from Jupiter API
      // jupiterAccounts: serializedAccounts, // Would be serialized Jupiter accounts
      // jupiterData: serializedData,    // Would be serialized Jupiter instruction
    };

    await aegis.requestSwap(swapParams);
    console.log('✅ Small swap executed immediately (no approval needed)');

    // Step 4: Check vault status after swap
    console.log('\n📊 Vault status after small swap:');
    const vaultInfo = await aegis.getVault(aiVault);
    console.log('- Remaining balance:', solToLamports(vaultInfo.balance.toNumber()).toString(), 'SOL');
    console.log('- Daily spent:', solToLamports(vaultInfo.dailySpent.toNumber()).toString(), 'SOL');
    console.log('- Daily limit:', solToLamports(5).toString(), 'SOL');
    console.log('- Pending actions:', vaultInfo.pendingActionsCount);

    // Step 5: AI tries a large swap (would require approval)
    console.log('\n🤖 AI Agent: Attempting large trade (1.5 SOL -> USDC)...');
    console.log('   This should create a pending action for approval...');

    const largeSwapParams: SwapRequestParams = {
      vaultPubkey: aiVault,
      amount: solToLamports(1.5),        // 1.5 SOL (above 1 SOL threshold)
      fromMint: WSOL_MINT,
      toMint: USDC_MINT,
      amountOutMin: solToLamports(1.35),
    };

    aegis.on('pendingActionCreated', (data) => {
      console.log('⏳ Large swap created pending action:', data.pendingAction.toString());
      console.log('   Requires manual approval before execution');
    });

    const result = await aegis.requestSwap(largeSwapParams);

    if (result.pendingAction) {
      console.log('✅ Large swap pending approval at:', result.pendingAction.toString());

      // In a real scenario, you would:
      // 1. Notify the vault owner
      // 2. Owner would call approvePendingAction(pendingActionPubkey)
      // 3. That would execute the Jupiter swap
    }

    console.log('\n🎉 AI small swap simulation completed!');
    console.log('🤖 AI can safely trade within limits without human intervention');
    console.log('👤 Large trades require human approval for security');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the example
main();
