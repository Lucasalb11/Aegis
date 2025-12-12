import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from '@solana/spl-token';
import BN from 'bn.js';

import { Aegis } from './aegis';
import { PoolInfo, LiquidityParams, SwapParams, AddLiquidityResult, SwapResult } from './types';
import { findPoolAddress, findPoolVaultAddress, findLpMintAddress } from './utils';

export class Pool {
  constructor(
    private aegis: Aegis,
    public info: PoolInfo
  ) {}

  static async create(
    aegis: Aegis,
    mintA: PublicKey,
    mintB: PublicKey,
    feeBps: number = 30,
    payer?: Keypair
  ): Promise<Pool> {
    const payerKey = payer?.publicKey || aegis.wallet.publicKey;
    const [poolAddress] = findPoolAddress(aegis.programId, mintA, mintB);
    const [vaultA] = findPoolVaultAddress(aegis.programId, poolAddress, mintA);
    const [vaultB] = findPoolVaultAddress(aegis.programId, poolAddress, mintB);
    const [lpMint] = findLpMintAddress(aegis.programId, poolAddress);

    const instruction = await this.createInitializeInstruction(
      aegis,
      poolAddress,
      mintA,
      mintB,
      vaultA,
      vaultB,
      lpMint,
      feeBps,
      payerKey
    );

    const transaction = new Transaction().add(instruction);

    if (payer) {
      transaction.feePayer = payer.publicKey;
      await sendAndConfirmTransaction(aegis.connection, transaction, [payer]);
    } else {
      await aegis.sendTransaction(transaction);
    }

    const poolInfo: PoolInfo = {
      address: poolAddress,
      mintA,
      mintB,
      vaultA,
      vaultB,
      lpMint,
      feeBps,
      lpSupply: new BN(0),
      creator: payerKey,
    };

    return new Pool(aegis, poolInfo);
  }

  private static async createInitializeInstruction(
    aegis: Aegis,
    pool: PublicKey,
    mintA: PublicKey,
    mintB: PublicKey,
    vaultA: PublicKey,
    vaultB: PublicKey,
    lpMint: PublicKey,
    feeBps: number,
    payer: PublicKey
  ): Promise<TransactionInstruction> {
    const data = Buffer.alloc(3);
    data.writeUInt16LE(feeBps, 0);
    data.writeUInt8(0, 2); // instruction discriminator for initialize_pool

    return new TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: mintA, isSigner: false, isWritable: false },
        { pubkey: mintB, isSigner: false, isWritable: false },
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: vaultA, isSigner: false, isWritable: true },
        { pubkey: vaultB, isSigner: false, isWritable: true },
        { pubkey: lpMint, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: aegis.programId,
      data,
    });
  }

  async addLiquidity(
    params: LiquidityParams,
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    userLpToken: PublicKey
  ): Promise<AddLiquidityResult> {
    const instruction = await this.createAddLiquidityInstruction(
      params,
      userTokenA,
      userTokenB,
      userLpToken
    );

    const transaction = new Transaction().add(instruction);
    await this.aegis.sendTransaction(transaction);

    // Calculate actual amounts used (simplified)
    return {
      pool: this.info.address,
      lpTokens: new BN(0), // Would be calculated from actual amounts
      amountAUsed: params.amountA,
      amountBUsed: params.amountB,
    };
  }

  private async createAddLiquidityInstruction(
    params: LiquidityParams,
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    userLpToken: PublicKey
  ): Promise<TransactionInstruction> {
    const data = Buffer.alloc(17);
    data.writeUInt8(1, 0); // instruction discriminator for add_liquidity
    params.amountA.toArray().forEach((byte, i) => data.writeUInt8(byte, i + 1));
    params.amountB.toArray().forEach((byte, i) => data.writeUInt8(byte, i + 9));

    return new TransactionInstruction({
      keys: [
        { pubkey: this.aegis.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: this.info.address, isSigner: false, isWritable: true },
        { pubkey: this.info.vaultA, isSigner: false, isWritable: true },
        { pubkey: this.info.vaultB, isSigner: false, isWritable: true },
        { pubkey: this.info.lpMint, isSigner: false, isWritable: true },
        { pubkey: userTokenA, isSigner: false, isWritable: true },
        { pubkey: userTokenB, isSigner: false, isWritable: true },
        { pubkey: userLpToken, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.aegis.programId,
      data,
    });
  }

  async swap(
    params: SwapParams,
    userSource: PublicKey,
    userDestination: PublicKey
  ): Promise<string> {
    const instruction = await this.createSwapInstruction(params, userSource, userDestination);

    const transaction = new Transaction().add(instruction);
    const signature = await this.aegis.sendTransaction(transaction);

    return signature;
  }

  private async createSwapInstruction(
    params: SwapParams,
    userSource: PublicKey,
    userDestination: PublicKey
  ): Promise<TransactionInstruction> {
    const data = Buffer.alloc(18);
    data.writeUInt8(2, 0); // instruction discriminator for swap
    params.amountIn.toArray().forEach((byte, i) => data.writeUInt8(byte, i + 1));
    params.minAmountOut.toArray().forEach((byte, i) => data.writeUInt8(byte, i + 9));
    data.writeUInt8(params.aToB ? 1 : 0, 17);

    // Determine source and destination mints based on swap direction
    const sourceMint = params.aToB ? this.info.mintA : this.info.mintB;
    const destinationMint = params.aToB ? this.info.mintB : this.info.mintA;

    return new TransactionInstruction({
      keys: [
        { pubkey: this.aegis.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: this.info.address, isSigner: false, isWritable: true },
        { pubkey: this.info.vaultA, isSigner: false, isWritable: true },
        { pubkey: this.info.vaultB, isSigner: false, isWritable: true },
        { pubkey: userSource, isSigner: false, isWritable: true },
        { pubkey: userDestination, isSigner: false, isWritable: true },
        { pubkey: sourceMint, isSigner: false, isWritable: false },
        { pubkey: destinationMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.aegis.programId,
      data,
    });
  }

  async refresh(): Promise<void> {
    // In a real implementation, this would fetch updated pool data from the blockchain
    // For now, this is a placeholder
  }
}

