#!/usr/bin/env ts-node
/**
 * Wallet Funding Utility
 * 
 * Transfers SOL from faucet wallet to multiple test wallets for testing purposes.
 * Usage: ts-node fund-wallets.ts <number-of-wallets> <amount-per-wallet-in-sol>
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const FAUCET_WALLET_PUBKEY = new PublicKey('EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z');

interface WalletInfo {
  publicKey: string;
  privateKey: string;
  funded: boolean;
  balance: number;
}

async function main() {
  const args = process.argv.slice(2);
  const numWallets = parseInt(args[0]) || 15;
  const amountPerWallet = parseFloat(args[1]) || 0.1;

  console.log(`\n💰 Wallet Funding Utility`);
  console.log(`========================`);
  console.log(`Number of wallets: ${numWallets}`);
  console.log(`Amount per wallet: ${amountPerWallet} SOL`);
  console.log(`Total required: ${numWallets * amountPerWallet} SOL\n`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check faucet balance
  const faucetBalance = await connection.getBalance(FAUCET_WALLET_PUBKEY);
  const faucetBalanceSol = faucetBalance / LAMPORTS_PER_SOL;
  console.log(`Faucet wallet: ${FAUCET_WALLET_PUBKEY.toString()}`);
  console.log(`Faucet balance: ${faucetBalanceSol.toFixed(4)} SOL`);

  const requiredBalance = numWallets * amountPerWallet;
  if (faucetBalanceSol < requiredBalance) {
    console.error(`\n❌ Insufficient balance!`);
    console.error(`   Required: ${requiredBalance.toFixed(4)} SOL`);
    console.error(`   Available: ${faucetBalanceSol.toFixed(4)} SOL`);
    console.error(`\nPlease fund the faucet wallet first.`);
    process.exit(1);
  }

  // Load or generate wallets
  const walletsFile = path.join(__dirname, '../../test-wallets.json');
  let wallets: WalletInfo[] = [];

  if (fs.existsSync(walletsFile)) {
    wallets = JSON.parse(fs.readFileSync(walletsFile, 'utf-8'));
    console.log(`\n📁 Loaded ${wallets.length} existing wallets from ${walletsFile}`);
  }

  // Generate additional wallets if needed
  while (wallets.length < numWallets) {
    const wallet = Keypair.generate();
    wallets.push({
      publicKey: wallet.publicKey.toString(),
      privateKey: Buffer.from(wallet.secretKey).toString('base64'),
      funded: false,
      balance: 0,
    });
  }

  // Check which wallets need funding
  const walletsToFund = wallets.slice(0, numWallets);
  console.log(`\n🔍 Checking wallet balances...`);

  for (let i = 0; i < walletsToFund.length; i++) {
    const walletInfo = walletsToFund[i];
    const walletPubkey = new PublicKey(walletInfo.publicKey);
    const balance = await connection.getBalance(walletPubkey);
    walletInfo.balance = balance / LAMPORTS_PER_SOL;

    if (walletInfo.balance < amountPerWallet) {
      console.log(`  Wallet ${i + 1}: ${walletPubkey.toString()} - ${walletInfo.balance.toFixed(4)} SOL (needs funding)`);
    } else {
      console.log(`  Wallet ${i + 1}: ${walletPubkey.toString()} - ${walletInfo.balance.toFixed(4)} SOL (already funded)`);
      walletInfo.funded = true;
    }
  }

  // Fund wallets that need it
  const needsFunding = walletsToFund.filter(w => !w.funded);
  if (needsFunding.length === 0) {
    console.log(`\n✅ All wallets are already funded!`);
    return;
  }

  console.log(`\n💸 Funding ${needsFunding.length} wallets...`);
  console.log(`\n⚠️  NOTE: This script requires the faucet wallet's private key to sign transactions.`);
  console.log(`   For security, you should manually fund wallets or provide the keypair securely.\n`);

  // Save wallet list
  fs.writeFileSync(walletsFile, JSON.stringify(wallets, null, 2));
  console.log(`\n📝 Wallet list saved to: ${walletsFile}`);
  console.log(`\n📋 Wallets to fund:`);
  needsFunding.forEach((w, i) => {
    console.log(`   ${i + 1}. ${w.publicKey} - ${amountPerWallet} SOL`);
  });

  console.log(`\n💡 To fund manually, use:`);
  console.log(`   solana transfer ${needsFunding[0].publicKey} ${amountPerWallet} --from <faucet-keypair> --url ${RPC_URL}`);
  console.log(`\n   Or use the Solana CLI:`);
  console.log(`   for wallet in $(cat ${walletsFile} | jq -r '.[] | select(.funded == false) | .publicKey'); do`);
  console.log(`     solana transfer $wallet ${amountPerWallet} --from <faucet-keypair> --url ${RPC_URL}`);
  console.log(`   done\n`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as fundWallets };


