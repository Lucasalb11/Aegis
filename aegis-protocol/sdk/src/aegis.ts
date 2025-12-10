import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Signer,
  Keypair,
} from '@solana/web3.js';
import { Wallet } from '@solana/web3.js';

import { AegisConfig, PoolInfo } from './types';
import { Pool } from './pool';
import { findPoolAddress } from './utils';

const DEFAULT_CONFIG: AegisConfig = {
  programId: new PublicKey('AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu'),
  cluster: 'devnet',
};

export class Aegis {
  public readonly config: AegisConfig;

  constructor(
    public readonly connection: Connection,
    public readonly wallet: Wallet,
    config: Partial<AegisConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get programId(): PublicKey {
    return this.config.programId;
  }

  static fromWallet(
    connection: Connection,
    wallet: Wallet,
    config?: Partial<AegisConfig>
  ): Aegis {
    return new Aegis(connection, wallet, config);
  }

  async sendTransaction(
    transaction: Transaction,
    additionalSigners: Signer[] = []
  ): Promise<string> {
    const { blockhash } = await this.connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    if (additionalSigners.length > 0) {
      transaction.sign(...additionalSigners);
    }

    const signedTransaction = await this.wallet.signTransaction(transaction);
    return sendAndConfirmTransaction(this.connection, signedTransaction, additionalSigners);
  }

  async getPool(mintA: PublicKey, mintB: PublicKey): Promise<Pool | null> {
    const [poolAddress] = findPoolAddress(this.programId, mintA, mintB);

    try {
      // In a real implementation, this would fetch pool data from the blockchain
      // For now, we'll return null to indicate pool doesn't exist
      // const poolAccount = await this.connection.getAccountInfo(poolAddress);
      // if (!poolAccount) return null;

      // Parse pool data and create Pool instance
      return null;
    } catch (error) {
      return null;
    }
  }

  async getOrCreatePool(
    mintA: PublicKey,
    mintB: PublicKey,
    feeBps: number = 30
  ): Promise<Pool> {
    let pool = await this.getPool(mintA, mintB);
    if (!pool) {
      pool = await Pool.create(this, mintA, mintB, feeBps);
    }
    return pool;
  }

  async getPools(): Promise<Pool[]> {
    // In a real implementation, this would query all pools
    // For now, return empty array
    return [];
  }

  async getUserPools(user: PublicKey): Promise<Pool[]> {
    // In a real implementation, this would query pools created by user
    // For now, return empty array
    return [];
  }
}