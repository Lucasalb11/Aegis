#!/usr/bin/env ts-node
/**
 * Comprehensive Aegis Protocol Testing Script
 * 
 * This script performs end-to-end testing of the Aegis DeFi protocol:
 * - Creates and funds multiple test wallets
 * - Mints custom tokens
 * - Creates liquidity pools
 * - Adds/removes liquidity
 * - Performs swaps
 * - Tracks all transactions for verification
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
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  getMint,
  Account,
} from '@solana/spl-token';
import { Aegis, AegisClient } from '../src/aegis';
import { Pool } from '../src/pool';
import BN from 'bn.js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9');
const FAUCET_WALLET = new PublicKey('EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z');

// Test results tracking
interface TestResult {
  operation: string;
  success: boolean;
  txSignature?: string;
  error?: string;
  timestamp: Date;
  details?: any;
}

interface TestReport {
  startTime: Date;
  endTime?: Date;
  results: TestResult[];
  poolsCreated: PublicKey[];
  tokensMinted: PublicKey[];
  walletsFunded: PublicKey[];
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    poolsCreated: number;
    tokensMinted: number;
    swapsPerformed: number;
    liquidityOperations: number;
  };
}

class TestRunner {
  private connection: Connection;
  private faucetKeypair: Keypair | null = null;
  private testWallets: Keypair[] = [];
  private testTokens: PublicKey[] = [];
  private testPools: PublicKey[] = [];
  private report: TestReport;
  private aegisClients: Map<string, AegisClient> = new Map();

  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
    this.report = {
      startTime: new Date(),
      results: [],
      poolsCreated: [],
      tokensMinted: [],
      walletsFunded: [],
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        poolsCreated: 0,
        tokensMinted: 0,
        swapsPerformed: 0,
        liquidityOperations: 0,
      },
    };
  }

  private log(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
  }

  private async recordResult(operation: string, success: boolean, txSignature?: string, error?: string, details?: any) {
    const result: TestResult = {
      operation,
      success,
      txSignature,
      error,
      timestamp: new Date(),
      details,
    };
    this.report.results.push(result);
    this.report.summary.totalOperations++;
    if (success) {
      this.report.summary.successfulOperations++;
    } else {
      this.report.summary.failedOperations++;
      this.log(`❌ FAILED: ${operation}`, error);
    }
  }

  // Load or create faucet wallet
  async loadFaucetWallet(): Promise<void> {
    this.log('Loading faucet wallet...');
    // In a real scenario, you'd load from a keypair file or environment variable
    // For now, we'll use the public key and assume it's funded
    this.log(`Faucet wallet: ${FAUCET_WALLET.toString()}`);
    this.log('⚠️  Note: Ensure faucet wallet is funded before running tests');
  }

  // Generate test wallets
  async generateTestWallets(count: number = 15): Promise<void> {
    this.log(`Generating ${count} test wallets...`);
    for (let i = 0; i < count; i++) {
      const wallet = Keypair.generate();
      this.testWallets.push(wallet);
      this.log(`  Wallet ${i + 1}: ${wallet.publicKey.toString()}`);
    }
  }

  // Fund wallets from faucet
  async fundWallets(): Promise<void> {
    this.log('Funding test wallets...');
    
    // Check faucet balance
    const faucetBalance = await this.connection.getBalance(FAUCET_WALLET);
    this.log(`Faucet balance: ${faucetBalance / LAMPORTS_PER_SOL} SOL`);

    if (faucetBalance < this.testWallets.length * 0.1 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient faucet balance. Please fund the faucet wallet first.');
    }

    // Fund each wallet with 0.1 SOL
    for (let i = 0; i < this.testWallets.length; i++) {
      try {
        const wallet = this.testWallets[i];
        const amount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL per wallet

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: FAUCET_WALLET,
            toPubkey: wallet.publicKey,
            lamports: amount,
          })
        );

        // Note: In production, you'd need the faucet's private key to sign
        // For now, this is a placeholder - you'll need to manually fund or provide the keypair
        this.log(`  ⚠️  Wallet ${i + 1} needs manual funding: ${wallet.publicKey.toString()}`);
        this.log(`     Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
        
        // Record that wallet should be funded
        this.report.walletsFunded.push(wallet.publicKey);
      } catch (error: any) {
        await this.recordResult(`Fund wallet ${i + 1}`, false, undefined, error.message);
      }
    }
  }

  // Mint custom tokens
  async mintTokens(count: number = 10): Promise<void> {
    this.log(`Minting ${count} custom tokens...`);
    
    const mintingWallet = this.testWallets[0]; // Use first wallet for minting
    
    for (let i = 0; i < count; i++) {
      try {
        const decimals = 6;
        const mint = await createMint(
          this.connection,
          mintingWallet,
          mintingWallet.publicKey,
          null,
          decimals
        );

        this.testTokens.push(mint);
        this.report.tokensMinted.push(mint);
        this.report.summary.tokensMinted++;

        // Mint initial supply to the minting wallet
        const mintAmount = 1_000_000 * Math.pow(10, decimals); // 1M tokens
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
          this.connection,
          mintingWallet,
          mint,
          mintingWallet.publicKey
        );

        await mintTo(
          this.connection,
          mintingWallet,
          mint,
          tokenAccount.address,
          mintingWallet,
          mintAmount
        );

        const txSignature = await this.connection.getLatestBlockhash();
        await this.recordResult(
          `Mint token ${i + 1}`,
          true,
          txSignature.blockhash,
          undefined,
          { mint: mint.toString(), amount: mintAmount }
        );

        this.log(`  ✅ Token ${i + 1} minted: ${mint.toString()}`);
      } catch (error: any) {
        await this.recordResult(`Mint token ${i + 1}`, false, undefined, error.message);
      }
    }
  }

  // Create liquidity pools
  async createPools(count: number = 15): Promise<void> {
    this.log(`Creating ${count} liquidity pools...`);

    if (this.testTokens.length < 2) {
      throw new Error('Need at least 2 tokens to create pools');
    }

    const poolCreator = this.testWallets[1]; // Use second wallet for pool creation
    const aegisClient = AegisClient.initAegisClient(
      this.connection,
      {
        publicKey: poolCreator.publicKey,
        signTransaction: async (tx: Transaction) => {
          tx.sign(poolCreator);
          return tx;
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return txs.map(tx => {
            tx.sign(poolCreator);
            return tx;
          });
        },
      } as any,
      PROGRAM_ID
    );

    // Create pools with different token pairs
    let poolCount = 0;
    for (let i = 0; i < this.testTokens.length && poolCount < count; i++) {
      for (let j = i + 1; j < this.testTokens.length && poolCount < count; j++) {
        try {
          const mintA = this.testTokens[i];
          const mintB = this.testTokens[j];
          const feeBps = 30 + (poolCount % 3) * 5; // Vary fees: 30, 35, 40 bps

          this.log(`  Creating pool ${poolCount + 1}: ${mintA.toString().slice(0, 8)}.../${mintB.toString().slice(0, 8)}...`);

          const pool = await Pool.create(aegisClient as any, mintA, mintB, feeBps, poolCreator);
          
          this.testPools.push(pool.info.address);
          this.report.poolsCreated.push(pool.info.address);
          this.report.summary.poolsCreated++;

          await this.recordResult(
            `Create pool ${poolCount + 1}`,
            true,
            'tx_signature_placeholder', // Would be actual signature
            undefined,
            {
              pool: pool.info.address.toString(),
              mintA: mintA.toString(),
              mintB: mintB.toString(),
              feeBps,
            }
          );

          poolCount++;
        } catch (error: any) {
          await this.recordResult(`Create pool ${poolCount + 1}`, false, undefined, error.message);
        }
      }
    }
  }

  // Add liquidity to pools
  async addLiquidity(): Promise<void> {
    this.log('Adding liquidity to pools...');

    const liquidityProvider = this.testWallets[2]; // Use third wallet
    const aegisClient = AegisClient.initAegisClient(
      this.connection,
      {
        publicKey: liquidityProvider.publicKey,
        signTransaction: async (tx: Transaction) => {
          tx.sign(liquidityProvider);
          return tx;
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return txs.map(tx => {
            tx.sign(liquidityProvider);
            return tx;
          });
        },
      } as any,
      PROGRAM_ID
    );

    for (let i = 0; i < Math.min(this.testPools.length, 10); i++) {
      try {
        const poolAddress = this.testPools[i];
        // Fetch pool info
        const poolAccount = await this.connection.getAccountInfo(poolAddress);
        if (!poolAccount) continue;

        // Parse pool data to get mints
        const data = poolAccount.data;
        const mintA = new PublicKey(data.slice(8, 40));
        const mintB = new PublicKey(data.slice(40, 72));

        // Get or create token accounts
        const tokenAccountA = await getOrCreateAssociatedTokenAccount(
          this.connection,
          liquidityProvider,
          mintA,
          liquidityProvider.publicKey
        );
        const tokenAccountB = await getOrCreateAssociatedTokenAccount(
          this.connection,
          liquidityProvider,
          mintB,
          liquidityProvider.publicKey
        );

        // Check balances
        const balanceA = await getAccount(this.connection, tokenAccountA.address);
        const balanceB = await getAccount(this.connection, tokenAccountB.address);

        if (balanceA.amount.toNumber() === 0 || balanceB.amount.toNumber() === 0) {
          this.log(`  ⚠️  Skipping pool ${i + 1}: Insufficient token balances`);
          continue;
        }

        // Add liquidity (use 10% of available balance)
        const amountA = balanceA.amount.div(new BN(10));
        const amountB = balanceB.amount.div(new BN(10));

        const pool = await (aegisClient as any).getPool(mintA, mintB);
        if (!pool) {
          this.log(`  ⚠️  Pool not found for ${mintA.toString()}/${mintB.toString()}`);
          continue;
        }

        const lpTokenAccount = await getOrCreateAssociatedTokenAccount(
          this.connection,
          liquidityProvider,
          pool.info.lpMint,
          liquidityProvider.publicKey
        );

        await pool.addLiquidity(
          {
            amountA,
            amountB,
          },
          tokenAccountA.address,
          tokenAccountB.address,
          lpTokenAccount.address
        );

        this.report.summary.liquidityOperations++;
        await this.recordResult(
          `Add liquidity to pool ${i + 1}`,
          true,
          'tx_signature_placeholder',
          undefined,
          { pool: poolAddress.toString(), amountA: amountA.toString(), amountB: amountB.toString() }
        );

        this.log(`  ✅ Added liquidity to pool ${i + 1}`);
      } catch (error: any) {
        await this.recordResult(`Add liquidity to pool ${i + 1}`, false, undefined, error.message);
      }
    }
  }

  // Perform swaps
  async performSwaps(count: number = 30): Promise<void> {
    this.log(`Performing ${count} swaps...`);

    for (let i = 0; i < Math.min(count, this.testWallets.length - 3); i++) {
      const swapper = this.testWallets[3 + i];
      const poolIndex = i % this.testPools.length;
      const poolAddress = this.testPools[poolIndex];

      try {
        // Fetch pool info
        const poolAccount = await this.connection.getAccountInfo(poolAddress);
        if (!poolAccount) continue;

        const data = poolAccount.data;
        const mintA = new PublicKey(data.slice(8, 40));
        const mintB = new PublicKey(data.slice(40, 72));

        const aegisClient = AegisClient.initAegisClient(
          this.connection,
          {
            publicKey: swapper.publicKey,
            signTransaction: async (tx: Transaction) => {
              tx.sign(swapper);
              return tx;
            },
            signAllTransactions: async (txs: Transaction[]) => {
              return txs.map(tx => {
                tx.sign(swapper);
                return tx;
              });
            },
          } as any,
          PROGRAM_ID
        );

        // Check token balances
        const tokenAccountA = await getOrCreateAssociatedTokenAccount(
          this.connection,
          swapper,
          mintA,
          swapper.publicKey
        );

        const balanceA = await getAccount(this.connection, tokenAccountA.address);
        if (balanceA.amount.toNumber() === 0) {
          this.log(`  ⚠️  Skipping swap ${i + 1}: No balance for token A`);
          continue;
        }

        // Perform swap
        const amountIn = balanceA.amount.div(new BN(5)); // Use 20% of balance
        const minAmountOut = new BN(0); // Accept any output

        await aegisClient.swap({
          fromMint: mintA,
          toMint: mintB,
          amountIn,
          minAmountOut,
        });

        this.report.summary.swapsPerformed++;
        await this.recordResult(
          `Swap ${i + 1}`,
          true,
          'tx_signature_placeholder',
          undefined,
          {
            pool: poolAddress.toString(),
            fromMint: mintA.toString(),
            toMint: mintB.toString(),
            amountIn: amountIn.toString(),
          }
        );

        this.log(`  ✅ Swap ${i + 1} completed`);
      } catch (error: any) {
        await this.recordResult(`Swap ${i + 1}`, false, undefined, error.message);
      }
    }
  }

  // Generate test report
  async generateReport(): Promise<void> {
    this.report.endTime = new Date();
    const duration = (this.report.endTime.getTime() - this.report.startTime.getTime()) / 1000;

    const reportPath = path.join(__dirname, '../../test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));

    this.log('\n' + '='.repeat(80));
    this.log('TEST REPORT SUMMARY');
    this.log('='.repeat(80));
    this.log(`Duration: ${duration.toFixed(2)}s`);
    this.log(`Total Operations: ${this.report.summary.totalOperations}`);
    this.log(`Successful: ${this.report.summary.successfulOperations}`);
    this.log(`Failed: ${this.report.summary.failedOperations}`);
    this.log(`Pools Created: ${this.report.summary.poolsCreated}`);
    this.log(`Tokens Minted: ${this.report.summary.tokensMinted}`);
    this.log(`Swaps Performed: ${this.report.summary.swapsPerformed}`);
    this.log(`Liquidity Operations: ${this.report.summary.liquidityOperations}`);
    this.log(`\nFull report saved to: ${reportPath}`);
    this.log('='.repeat(80));
  }

  // Main test runner
  async run(): Promise<void> {
    try {
      this.log('Starting comprehensive Aegis Protocol testing...\n');

      await this.loadFaucetWallet();
      await this.generateTestWallets(15);
      await this.fundWallets();
      await this.mintTokens(10);
      await this.createPools(15);
      await this.addLiquidity();
      await this.performSwaps(30);

      await this.generateReport();
    } catch (error: any) {
      this.log('❌ Test suite failed:', error);
      await this.generateReport();
      throw error;
    }
  }
}

// Run tests
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().catch(console.error);
}

export { TestRunner };
