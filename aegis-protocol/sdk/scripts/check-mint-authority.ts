#!/usr/bin/env ts-node
/**
 * Check Mint Authority
 * 
 * Verifica quem é a mint authority de cada token
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import {
  getMint,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPath = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../.env.local'),
].find(p => fs.existsSync(p)) || path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

async function loadTokensConfig() {
  const tokensPath = process.env.TOKENS_CONFIG_PATH || path.join(__dirname, '../config/devnet.tokens.json');
  const data = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  return data.tokens || data;
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  const tokens = await loadTokensConfig();

  console.log('\n🔍 Checking Mint Authorities\n');
  console.log('='.repeat(60));

  for (const token of tokens) {
    if (token.mint === 'So1111111111111111111111111111111112' || token.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
      continue;
    }

    try {
      const mintPubkey = new PublicKey(token.mint);
      const mintInfo = await getMint(connection, mintPubkey);
      
      console.log(`\n${token.symbol} (${token.mint}):`);
      console.log(`  Decimals: ${mintInfo.decimals}`);
      console.log(`  Supply: ${mintInfo.supply.toString()}`);
      console.log(`  Mint Authority: ${mintInfo.mintAuthority ? mintInfo.mintAuthority.toString() : 'NONE (frozen)'}`);
    } catch (error: any) {
      console.log(`\n${token.symbol}: ❌ ${error.message}`);
    }
  }
  console.log('\n');
}

main().catch(console.error);
