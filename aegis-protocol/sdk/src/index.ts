import { Connection, PublicKey, Transaction, Signer } from '@solana/web3.js';
import { AnchorProvider, Program, BN, Idl, Wallet } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { EventEmitter } from 'eventemitter3';
import idlJson from './idl.json';

// Add address and metadata to IDL
const idl = { 
  ...idlJson, 
  address: '',
  metadata: {
    name: idlJson.name,
    version: idlJson.version,
    spec: '0.1.0'
  }
} as any as Idl;

// Types
export interface PolicyConfig {
  dailySpendLimitLamports: BN;
  largeTxThresholdLamports: BN;
}

export interface SwapRequestParams {
  vaultPubkey: PublicKey;
  amount: BN;
  fromMint: PublicKey;
  toMint: PublicKey;
  amountOutMin: BN;
  jupiterRoute?: any; // Jupiter route data - simplified for now
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
        policyConfig.largeTxThresholdLamports
      )
      .accounts({
        owner,
        authority: owner,
        vault: vaultPDA,
        policy: policyPDA,
        systemProgram: this.program.programId,
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
    const amountLamports = new BN(amountSol * 1_000_000_000); // Convert SOL to lamports

    // Derive policy PDA (needed for account validation)
    const [policyPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), vaultPubkey.toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .depositSol(amountLamports)
      .accounts({
        owner,
        vault: vaultPubkey,
        policy: policyPDA,
        systemProgram: this.program.programId,
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
      jupiterAccounts = Buffer.alloc(0),
      jupiterData = Buffer.alloc(0),
    } = params;

    // Derive PDAs
    const [policyPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), vaultPubkey.toBuffer()],
      this.program.programId
    );

    // Get vault account to check pending actions count
    const vaultAccount = await (this.program.account as any).vault.fetch(vaultPubkey);

    // Derive source and destination token accounts
    const sourceTokenAccount = await getAssociatedTokenAddress(fromMint, vaultPubkey, true);
    const destinationTokenAccount = await getAssociatedTokenAddress(toMint, vaultPubkey, true);

    // Check if this is a large transaction
    const isLargeTx = amount.gt(vaultAccount.policy.largeTxThresholdLamports);

    let accounts: any = {
      authority: this.wallet.publicKey,
      vault: vaultPubkey,
      sourceTokenAccount,
      destinationTokenAccount,
      policy: policyPDA,
      jupiterProgram: new PublicKey('JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4'),
      systemProgram: this.program.programId,
      clock: this.program.programId, // Sysvar clock
    };

    if (isLargeTx) {
      // Derive pending action PDA
      const [pendingActionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('pending_action'),
          vaultPubkey.toBuffer(),
          Buffer.from([vaultAccount.pendingActionsCount]),
        ],
        this.program.programId
      );

      accounts.pendingAction = pendingActionPDA;
    }

    const tx = await this.program.methods
      .requestSwapJupiter(
        amount,
        amountOutMin,
        Array.from(jupiterAccounts),
        Array.from(jupiterData)
      )
      .accounts(accounts)
      .rpc();

    const result: any = { txSignature: tx };

    if (isLargeTx) {
      result.pendingAction = accounts.pendingAction;
      this.emit('pendingActionCreated', {
        vault: vaultPubkey,
        pendingAction: accounts.pendingAction,
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
    const pendingAction = await (this.program.account as any).pendingAction.fetch(pendingActionPubkey);

    const tx = await this.program.methods
      .approvePendingAction()
      .accounts({
        owner: this.wallet.publicKey,
        vault: pendingAction.vault,
        pendingAction: pendingActionPubkey,
        clock: this.program.programId, // Sysvar clock
      })
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
    // This would require indexing or querying all pending actions
    // For now, return empty array as placeholder
    return [];
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
