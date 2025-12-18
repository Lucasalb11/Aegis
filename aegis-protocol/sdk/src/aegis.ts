import {
  Connection,
  PublicKey,
  Transaction,
  Signer,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import BN from 'bn.js';

import { AegisConfig, PoolInfo } from './types';
import { Pool } from './pool';
import { findPoolAddress } from './utils';

// Anchor Wallet interface
export interface Wallet {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
}

const DEFAULT_CONFIG: AegisConfig = {
  programId: new PublicKey('FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9'),
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
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    // Sign with wallet
    const signedTransaction = await this.wallet.signTransaction(transaction);

    // Send and confirm transaction
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Wait for confirmation
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    return signature;
  }

  async getPool(mintA: PublicKey, mintB: PublicKey): Promise<Pool | null> {
    const [poolAddress] = findPoolAddress(this.programId, mintA, mintB);

    try {
      const poolAccount = await this.connection.getAccountInfo(poolAddress);
      if (!poolAccount) return null;

      // Parse pool data from account
      const data = poolAccount.data;
      if (data.length < 219) return null; // Pool::SIZE

      // Check discriminator
      const discriminator = data.slice(0, 8);
      const expectedDiscriminator = Buffer.from([241, 154, 109, 4, 17, 177, 109, 188]);
      if (!discriminator.equals(expectedDiscriminator)) return null;

      // Parse pool data
      const mintA_parsed = new PublicKey(data.slice(8, 40));
      const mintB_parsed = new PublicKey(data.slice(40, 72));
      const vaultA = new PublicKey(data.slice(72, 104));
      const vaultB = new PublicKey(data.slice(104, 136));
      const lpMint = new PublicKey(data.slice(136, 168));
      const feeBps = data.readUInt16LE(168);
      const lpSupply = new BN(data.readBigUInt64LE(170).toString());
      const creator = new PublicKey(data.slice(178, 210));

      const poolInfo: PoolInfo = {
        address: poolAddress,
        mintA: mintA_parsed,
        mintB: mintB_parsed,
        vaultA,
        vaultB,
        lpMint,
        feeBps,
        lpSupply: lpSupply,
        creator,
      };

      return new Pool(this, poolInfo);
    } catch (error) {
      console.warn('Failed to fetch pool:', error);
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
    try {
      // Query all pool accounts by size
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            dataSize: 219, // Pool::SIZE
          },
        ],
      });

      const pools: Pool[] = [];

      for (const account of accounts) {
        try {
          const data = account.account.data;

          // Check discriminator
          const discriminator = data.slice(0, 8);
          const expectedDiscriminator = Buffer.from([241, 154, 109, 4, 17, 177, 109, 188]);
          if (!discriminator.equals(expectedDiscriminator)) continue;

          // Parse pool data
          const mintA = new PublicKey(data.slice(8, 40));
          const mintB = new PublicKey(data.slice(40, 72));
          const vaultA = new PublicKey(data.slice(72, 104));
          const vaultB = new PublicKey(data.slice(104, 136));
          const lpMint = new PublicKey(data.slice(136, 168));
          const feeBps = data.readUInt16LE(168);
          const lpSupply = new BN(data.readBigUInt64LE(170).toString());
          const creator = new PublicKey(data.slice(178, 210));

          const poolInfo: PoolInfo = {
            address: account.pubkey,
            mintA,
            mintB,
            vaultA,
            vaultB,
            lpMint,
            feeBps,
            lpSupply,
            creator,
          };

          pools.push(new Pool(this, poolInfo));
        } catch (err) {
          console.warn('Failed to parse pool account:', account.pubkey.toString(), err);
        }
      }

      return pools;
    } catch (error) {
      console.warn('Failed to fetch pools:', error);
      return [];
    }
  }

  async getUserPools(user: PublicKey): Promise<Pool[]> {
    const allPools = await this.getPools();
    return allPools.filter(pool => pool.info.creator.equals(user));
  }
}

// AegisClient for backward compatibility
export class AegisClient extends Aegis {
  static initAegisClient(
    connection: Connection,
    wallet: Wallet,
    programId: PublicKey
  ): AegisClient {
    return new AegisClient(connection, wallet, { programId });
  }

  async swap(params: {
    fromMint: PublicKey;
    toMint: PublicKey;
    amountIn: BN;
    minAmountOut: BN;
  }): Promise<string> {
    const pool = await this.getPool(params.fromMint, params.toMint);
    if (!pool) {
      throw new Error('Pool not found for the given token pair');
    }

    // Get user's associated token accounts
    const userSourceToken = await getAssociatedTokenAddress(params.fromMint, this.wallet.publicKey);
    const userDestinationToken = await getAssociatedTokenAddress(params.toMint, this.wallet.publicKey);

    // Determine if it's A->B or B->A based on mint order
    const [mintA, mintB] = params.fromMint.toBuffer().compare(params.toMint.toBuffer()) < 0
      ? [params.fromMint, params.toMint]
      : [params.toMint, params.fromMint];

    const aToB = params.fromMint.equals(mintA);

    // Check if user has the source token account
    try {
      await getAccount(this.connection, userSourceToken);
    } catch (error) {
      throw new Error(`User does not have token account for source token. Please create it first.`);
    }

    // For destination token, check if it exists, if not we'll assume the program handles it
    let destinationExists = true;
    try {
      await getAccount(this.connection, userDestinationToken);
    } catch (error) {
      destinationExists = false;
    }

    if (!destinationExists) {
      throw new Error(`User does not have token account for destination token. Please create it first.`);
    }

    const signature = await pool.swap({
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
      aToB,
    }, userSourceToken, userDestinationToken);

    return signature;
  }
}

