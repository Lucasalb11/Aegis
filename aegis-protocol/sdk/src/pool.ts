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
import { PoolInfo, LiquidityParams, SwapParams, AddLiquidityResult, SwapResult, RemoveLiquidityParams, RemoveLiquidityResult } from './types';
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
    // Discriminator correto do IDL para initializePool
    const discriminator = Buffer.from([95, 180, 10, 172, 84, 174, 232, 40]);
    
    // Serializar o argumento feeBps (u16 em little-endian)
    const feeBpsBuffer = Buffer.alloc(2);
    feeBpsBuffer.writeUInt16LE(feeBps, 0);
    
    // Combinar discriminator + args
    const data = Buffer.concat([discriminator, feeBpsBuffer]);

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
    // Discriminator correto do IDL para addLiquidity
    const discriminator = Buffer.from([181, 157, 89, 67, 143, 182, 52, 72]);
    
    // Serializar amount_a (u64) e amount_b (u64) em little-endian
    const amountABuffer = Buffer.alloc(8);
    amountABuffer.writeBigUInt64LE(BigInt(params.amountA.toString()));
    
    const amountBBuffer = Buffer.alloc(8);
    amountBBuffer.writeBigUInt64LE(BigInt(params.amountB.toString()));
    
    // Combinar discriminator + args
    const data = Buffer.concat([discriminator, amountABuffer, amountBBuffer]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.aegis.wallet.publicKey, isSigner: true, isWritable: true },
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
    // Discriminator correto do IDL para swap
    const discriminator = Buffer.from([248, 198, 158, 145, 225, 117, 135, 200]);
    
    // Serializar amount_in (u64), min_amount_out (u64), a_to_b (bool)
    const amountInBuffer = Buffer.alloc(8);
    amountInBuffer.writeBigUInt64LE(BigInt(params.amountIn.toString()));
    
    const minAmountOutBuffer = Buffer.alloc(8);
    minAmountOutBuffer.writeBigUInt64LE(BigInt(params.minAmountOut.toString()));
    
    const aToB = Buffer.from([params.aToB ? 1 : 0]);
    
    // Combinar discriminator + args
    const data = Buffer.concat([discriminator, amountInBuffer, minAmountOutBuffer, aToB]);

    // Determine source and destination mints based on swap direction
    const sourceMint = params.aToB ? this.info.mintA : this.info.mintB;
    const destinationMint = params.aToB ? this.info.mintB : this.info.mintA;

    return new TransactionInstruction({
      keys: [
        { pubkey: this.aegis.wallet.publicKey, isSigner: true, isWritable: true },
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

  async removeLiquidity(
    params: RemoveLiquidityParams,
    userLpToken: PublicKey,
    userTokenA: PublicKey,
    userTokenB: PublicKey
  ): Promise<RemoveLiquidityResult> {
    const instruction = await this.createRemoveLiquidityInstruction(
      params,
      userLpToken,
      userTokenA,
      userTokenB
    );

    const transaction = new Transaction().add(instruction);
    await this.aegis.sendTransaction(transaction);

    // Return result (actual amounts would be calculated from transaction)
    return {
      pool: this.info.address,
      lpBurned: params.lpAmount,
      amountAReceived: new BN(0), // Would be calculated from actual transaction
      amountBReceived: new BN(0),
    };
  }

  private async createRemoveLiquidityInstruction(
    params: RemoveLiquidityParams,
    userLpToken: PublicKey,
    userTokenA: PublicKey,
    userTokenB: PublicKey
  ): Promise<TransactionInstruction> {
    // Discriminator from IDL for removeLiquidity
    const discriminator = Buffer.from([80, 85, 209, 72, 24, 206, 177, 108]);
    
    // Serialize lp_amount (u64) in little-endian
    const lpAmountBuffer = Buffer.alloc(8);
    lpAmountBuffer.writeBigUInt64LE(BigInt(params.lpAmount.toString()));
    
    // Combine discriminator + args
    const data = Buffer.concat([discriminator, lpAmountBuffer]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.aegis.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: this.info.address, isSigner: false, isWritable: true },
        { pubkey: this.info.vaultA, isSigner: false, isWritable: true },
        { pubkey: this.info.vaultB, isSigner: false, isWritable: true },
        { pubkey: this.info.lpMint, isSigner: false, isWritable: true },
        { pubkey: userLpToken, isSigner: false, isWritable: true },
        { pubkey: userTokenA, isSigner: false, isWritable: true },
        { pubkey: userTokenB, isSigner: false, isWritable: true },
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

