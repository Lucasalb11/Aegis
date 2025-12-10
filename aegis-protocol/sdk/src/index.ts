import {
  AccountMeta,
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { AnchorProvider, Program, BN, Idl, Wallet } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { EventEmitter } from 'eventemitter3';
import idlJson from './idl.json';

// Add address and metadata to IDL
const idl = {
  ...idlJson,
  address: idlJson.address ?? idlJson.metadata?.address,
  metadata: {
    name: idlJson.name,
    version: idlJson.version,
    spec: '0.1.0',
  },
} as any as Idl;

export const MAX_JUPITER_ACCOUNTS_LEN = 1024;
export const MAX_JUPITER_IX_DATA_LEN = 512;

// Types
export interface PolicyConfig {
  dailySpendLimitLamports: BN;
  largeTxThresholdLamports: BN;
  allowedPrograms?: PublicKey[];
}

export interface SwapRequestParams {
  vaultPubkey: PublicKey;
  amount: BN;
  fromMint: PublicKey;
  toMint: PublicKey;
  amountOutMin: BN;
  jupiterIx?: TransactionInstruction; // Optional Jupiter IX to derive metas/data
  jupiterMetas?: AccountMeta[]; // Raw metas (if already parsed)
  jupiterAccounts?: Buffer; // Serialized Jupiter account metas
  jupiterData?: Buffer; // Serialized Jupiter instruction data
}

export interface AegisClientConfig {
  connection: Connection;
  wallet: Wallet;
  programId: PublicKey;
}

/**
 * Aegis Protocol TypeScript SDK
 * Provides a high-level interface for interacting with Aegis smart vaults
 */
export class AegisClient extends EventEmitter {
  private provider: AnchorProvider;
  private program: Program<Idl>;
  private wallet: Wallet;

  private static readonly DEFAULT_ALLOWED_PROGRAMS = [
    new PublicKey('JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4'),
  ];

  constructor(config: AegisClientConfig) {
    super();

    this.wallet = config.wallet;
    this.provider = new AnchorProvider(config.connection, config.wallet, {});
    // Create program - using type assertion to work around TypeScript strict checking
    const createProgram = (idl: Idl, programId: PublicKey, provider: AnchorProvider): Program<Idl> => {
      return new (Program as any)(idl, programId, provider);
    };
    this.program = createProgram(idl as unknown as Idl, config.programId, this.provider);
  }

  /**
   * Serialize Jupiter AccountMeta[] into a Borsh Vec<u8> expected by the program.
   * Throws if the serialized buffer exceeds on-chain MAX_* limits.
   */
  static serializeJupiterMetas(metas: AccountMeta[]): Buffer {
    const length = metas.length;
    const buf = Buffer.alloc(4 + length * 34); // u32 len + (32 + 1 + 1) per meta
    buf.writeUInt32LE(length, 0);
    let offset = 4;
    metas.forEach((meta) => {
      meta.pubkey.toBuffer().copy(buf, offset);
      offset += 32;
      buf.writeUInt8(meta.isSigner ? 1 : 0, offset);
      offset += 1;
      buf.writeUInt8(meta.isWritable ? 1 : 0, offset);
      offset += 1;
    });

    if (buf.length > MAX_JUPITER_ACCOUNTS_LEN) {
      throw new Error(`Serialized Jupiter metas overflow (${buf.length} > ${MAX_JUPITER_ACCOUNTS_LEN})`);
    }
    return buf;
  }

  /**
   * Deserialize Jupiter metas from Borsh Vec<u8> (helper for pending approvals)
   */
  static deserializeJupiterMetas(buf: Buffer): AccountMeta[] {
    if (!buf?.length) return [];
    if (buf.length > MAX_JUPITER_ACCOUNTS_LEN) {
      throw new Error(`Serialized Jupiter metas overflow (${buf.length} > ${MAX_JUPITER_ACCOUNTS_LEN})`);
    }
    const metas: AccountMeta[] = [];
    const len = buf.readUInt32LE(0);
    let offset = 4;
    for (let i = 0; i < len; i++) {
      const pubkey = new PublicKey(buf.slice(offset, offset + 32));
      offset += 32;
      const isSigner = buf.readUInt8(offset) === 1;
      offset += 1;
      const isWritable = buf.readUInt8(offset) === 1;
      offset += 1;
      metas.push({ pubkey, isSigner, isWritable });
    }
    return metas;
  }

  /**
   * Initialize a new AegisClient
   */
  static initAegisClient(connection: Connection, wallet: Wallet, programId: PublicKey): AegisClient {
    return new AegisClient({ connection, wallet, programId });
  }

  /**
   * Create a new smart vault with spending policies
   */
  async createVault(policyConfig: PolicyConfig): Promise<{
    vault: PublicKey;
    policy: PublicKey;
    txSignature: string;
  }> {
    const owner = this.wallet.publicKey;
    const allowedPrograms =
      policyConfig.allowedPrograms?.length
        ? policyConfig.allowedPrograms
        : AegisClient.DEFAULT_ALLOWED_PROGRAMS;

    // Derive PDA addresses
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), owner.toBuffer()],
      this.program.programId
    );

    const [policyPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), vaultPDA.toBuffer()],
      this.program.programId
    );

    // Build instruction
    const tx = await this.program.methods
      .initializeVault(
        policyConfig.dailySpendLimitLamports,
        policyConfig.largeTxThresholdLamports,
        allowedPrograms
      )
      .accounts({
        owner,
        authority: owner,
        vault: vaultPDA,
        policy: policyPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    this.emit('vaultCreated', { vault: vaultPDA, policy: policyPDA, txSignature: tx });

    return {
      vault: vaultPDA,
      policy: policyPDA,
      txSignature: tx,
    };
  }

  /**
   * Deposit SOL into a vault
   */
  async depositSol(vaultPubkey: PublicKey, amountSol: number): Promise<string> {
    const owner = this.wallet.publicKey;
    const amountLamports = new BN(Math.round(amountSol * 1_000_000_000)); // Convert SOL to lamports safely

    const tx = await this.program.methods
      .depositSol(amountLamports)
      .accounts({
        owner,
        vault: vaultPubkey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    this.emit('solDeposited', { vault: vaultPubkey, amount: amountLamports, txSignature: tx });

    return tx;
  }

  /**
   * Request a swap through Jupiter with policy validation
   */
  async requestSwap(params: SwapRequestParams): Promise<{
    pendingAction?: PublicKey;
    txSignature: string;
  }> {
    const {
      vaultPubkey,
      amount,
      fromMint,
      toMint,
      amountOutMin,
      jupiterIx,
      jupiterMetas,
      jupiterAccounts = Buffer.alloc(0),
      jupiterData = Buffer.alloc(0),
    } = params;

    const resolvedMetas: AccountMeta[] | undefined = jupiterIx?.keys ?? jupiterMetas;
    const serializedMetas =
      jupiterAccounts?.length && !resolvedMetas
        ? jupiterAccounts
        : resolvedMetas?.length
          ? AegisClient.serializeJupiterMetas(resolvedMetas)
          : Buffer.alloc(0);

    if (serializedMetas.length > MAX_JUPITER_ACCOUNTS_LEN) {
      throw new Error('Jupiter metas buffer exceeds on-chain limit');
    }

    const instructionData = jupiterData?.length
      ? jupiterData
      : jupiterIx
        ? Buffer.from(jupiterIx.data)
        : Buffer.alloc(0);

    if (instructionData.length > MAX_JUPITER_IX_DATA_LEN) {
      throw new Error('Jupiter instruction data exceeds on-chain limit');
    }

    // Derive PDAs
    const [policyPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), vaultPubkey.toBuffer()],
      this.program.programId
    );

    // Fetch vault and policy for thresholds/counts
    const vaultAccount = await (this.program.account as any).vault.fetch(vaultPubkey);
    const policyAccount = await (this.program.account as any).policy.fetch(policyPDA);

    // Derive source and destination token accounts
    const sourceTokenAccount = await getAssociatedTokenAddress(
      fromMint,
      vaultPubkey,
      true
    );
    const destinationTokenAccount = await getAssociatedTokenAddress(
      toMint,
      vaultPubkey,
      true
    );

    // Check if this is a large transaction
    const largeThreshold = new BN(policyAccount.largeTxThresholdLamports);
    const isLargeTx = amount.gt(largeThreshold);

    let accounts: any = {
      authority: this.wallet.publicKey,
      vault: vaultPubkey,
      sourceTokenAccount,
      destinationTokenAccount,
      policy: policyPDA,
      jupiterProgram: jupiterIx?.programId ?? new PublicKey('JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4'),
      systemProgram: SystemProgram.programId,
      clock: SYSVAR_CLOCK_PUBKEY,
    };

    let pendingActionPDA: PublicKey | undefined;
    if (isLargeTx) {
      // Derive pending action PDA
      const pendingActionsCount = Number(vaultAccount.pendingActionsCount ?? 0);
      [pendingActionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('pending_action'),
          vaultPubkey.toBuffer(),
          Buffer.from([pendingActionsCount]),
        ],
        this.program.programId
      );

      accounts.pendingAction = pendingActionPDA;
    }

    const remainingAccounts =
      resolvedMetas?.length
        ? resolvedMetas
            .filter(
              (meta) =>
                !meta.pubkey.equals(vaultPubkey) &&
                !meta.pubkey.equals(sourceTokenAccount) &&
                !meta.pubkey.equals(destinationTokenAccount)
            )
            .map((meta) => ({
              pubkey: meta.pubkey,
              isSigner: meta.isSigner,
              isWritable: meta.isWritable,
            }))
        : [];

    const tx = await this.program.methods
      .requestSwapJupiter(
        amount,
        amountOutMin,
        Array.from(serializedMetas),
        Array.from(instructionData)
      )
      .accounts(accounts)
      .remainingAccounts(remainingAccounts)
      .rpc();

    const result: any = { txSignature: tx };

    if (isLargeTx && pendingActionPDA) {
      result.pendingAction = pendingActionPDA;
      this.emit('pendingActionCreated', {
        vault: vaultPubkey,
        pendingAction: pendingActionPDA,
        txSignature: tx
      });
    } else {
      this.emit('swapExecuted', {
        vault: vaultPubkey,
        amountIn: amount,
        amountOutMin,
        txSignature: tx
      });
    }

    return result;
  }

  /**
   * Approve a pending action
   */
  async approvePendingAction(pendingActionPubkey: PublicKey): Promise<string> {
    // Fetch pending action to get vault pubkey
    const pendingAction = await (this.program.account as any).pendingAction.fetch(
      pendingActionPubkey
    );
    const metas = pendingAction.jupiterAccounts?.length
      ? AegisClient.deserializeJupiterMetas(Buffer.from(pendingAction.jupiterAccounts))
      : [];
    const remainingAccounts = metas
      .filter(
        (meta: AccountMeta) =>
          !meta.pubkey.equals(pendingAction.vault) &&
          !meta.pubkey.equals(pendingAction.sourceTokenAccount) &&
          !meta.pubkey.equals(pendingAction.destinationTokenAccount)
      )
      .map((meta: AccountMeta) => ({
        pubkey: meta.pubkey,
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
      }));

    const [policyPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), pendingAction.vault.toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .approvePendingAction()
      .accounts({
        owner: this.wallet.publicKey,
        vault: pendingAction.vault,
        pendingAction: pendingActionPubkey,
        policy: policyPDA,
        sourceTokenAccount: pendingAction.sourceTokenAccount,
        destinationTokenAccount: pendingAction.destinationTokenAccount,
        jupiterProgram: pendingAction.targetProgram,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .remainingAccounts(remainingAccounts)
      .rpc();

    this.emit('pendingActionApproved', {
      pendingAction: pendingActionPubkey,
      vault: pendingAction.vault,
      txSignature: tx
    });

    return tx;
  }

  /**
   * Get vault information
   */
  async getVault(vaultPubkey: PublicKey) {
    return await (this.program.account as any).vault.fetch(vaultPubkey);
  }

  /**
   * Get policy information
   */
  async getPolicy(vaultPubkey: PublicKey) {
    const [policyPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), vaultPubkey.toBuffer()],
      this.program.programId
    );

    return await (this.program.account as any).policy.fetch(policyPDA);
  }

  /**
   * Get pending actions for a vault
   */
  async getPendingActions(vaultPubkey: PublicKey) {
    const discriminatorOffset = 8; // anchor account discriminator
    const filters = [
      {
        memcmp: {
          offset: discriminatorOffset,
          bytes: vaultPubkey.toBase58(),
        },
      },
    ];
    const accounts = await (this.program.account as any).pendingAction.all(filters);
    return accounts.map((acc: any) => ({
      publicKey: acc.publicKey as PublicKey,
      account: acc.account,
    }));
  }

  /**
   * Get program instance (for advanced usage)
   */
  getProgram(): Program<Idl> {
    return this.program;
  }

  /**
   * Get provider instance
   */
  getProvider(): AnchorProvider {
    return this.provider;
  }

  /**
   * Execute a direct swap against the Aegis AMM pool (constant-product).
   * Assumes the user already has ATAs for both mints.
   */
  async swap(params: {
    fromMint: PublicKey;
    toMint: PublicKey;
    amountIn: BN;
    minAmountOut: BN;
  }): Promise<string> {
    const { fromMint, toMint, amountIn, minAmountOut } = params;
    if (fromMint.equals(toMint)) {
      throw new Error('fromMint and toMint must differ');
    }

    // Sort mints to derive the pool PDA (mint_a < mint_b)
    const [mintA, mintB] =
      fromMint.toBuffer().compare(toMint.toBuffer()) < 0
        ? [fromMint, toMint]
        : [toMint, fromMint];

    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), mintA.toBuffer(), mintB.toBuffer()],
      this.program.programId
    );

    // Fetch on-chain pool to ensure it exists and get vault addresses
    const poolAccount = await (this.program.account as any).pool.fetchNullable(poolPda);
    if (!poolAccount) {
      throw new Error('Pool not found for provided mints');
    }

    const aToB = fromMint.equals(poolAccount.mintA);

    const userSource = await getAssociatedTokenAddress(fromMint, this.wallet.publicKey);
    const userDestination = await getAssociatedTokenAddress(toMint, this.wallet.publicKey);

    const tx = await this.program.methods
      .swap(amountIn, minAmountOut, aToB)
      .accounts({
        user: this.wallet.publicKey,
        pool: poolPda,
        vaultA: poolAccount.vaultA,
        vaultB: poolAccount.vaultB,
        userSource,
        userDestination,
        swapSourceMint: fromMint,
        swapDestinationMint: toMint,
        tokenProgram: (await import('@solana/spl-token')).TOKEN_PROGRAM_ID,
      })
      .rpc();

    this.emit('swapExecuted', {
      vault: null,
      amountIn,
      amountOutMin: minAmountOut,
      txSignature: tx,
    });

    return tx;
  }
}

// Export types and utilities
export * from './types';

// Event types
export interface AegisEvents {
  vaultCreated: (data: { vault: PublicKey; policy: PublicKey; txSignature: string }) => void;
  solDeposited: (data: { vault: PublicKey; amount: BN; txSignature: string }) => void;
  swapExecuted: (data: { vault: PublicKey; amountIn: BN; amountOutMin: BN; txSignature: string }) => void;
  pendingActionCreated: (data: { vault: PublicKey; pendingAction: PublicKey; txSignature: string }) => void;
  pendingActionApproved: (data: { pendingAction: PublicKey; vault: PublicKey; txSignature: string }) => void;
}
