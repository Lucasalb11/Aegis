import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  createTransferInstruction,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import BN from "bn.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const idl = require("../idl/aegis_protocol.json");

describe("aegis-protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection as Connection;
  const wallet = provider.wallet as anchor.Wallet;
  const payer = (wallet as any).payer as Keypair;

  const program = new anchor.Program(idl as anchor.Idl, provider);
  const programId = program.programId;

  // Vault config
  const dailySpendLimit = new BN(10 * LAMPORTS_PER_SOL);
  const largeTxThreshold = new BN(5 * LAMPORTS_PER_SOL);
  const allowedPrograms = [TOKEN_PROGRAM_ID];

  // PDAs
  let vaultPDA: PublicKey;
  let policyPDA: PublicKey;
  let pendingActionPDA: PublicKey;

  // Token accounts for swap tests
  let mintA: PublicKey;
  let vaultSource: PublicKey;
  let vaultDestination: PublicKey;
  let userReceive: PublicKey;

  // AMM mints/accounts
  let mintB: PublicKey;
  let poolPda: PublicKey;
  let poolVaultA: PublicKey;
  let poolVaultB: PublicKey;
  let lpMint: PublicKey;
  let oracleConfig: PublicKey;
  let userTokenA: PublicKey;
  let userTokenB: PublicKey;
  let userLpToken: PublicKey;

  const encodeMetas = (ix: TransactionInstruction) => {
    const buf = Buffer.alloc(4 + ix.keys.length * (32 + 1 + 1));
    buf.writeUInt32LE(ix.keys.length, 0);
    ix.keys.forEach((meta, idx) => {
      meta.pubkey.toBuffer().copy(buf, 4 + idx * 34);
      buf[4 + idx * 34 + 32] = meta.isSigner ? 1 : 0;
      buf[4 + idx * 34 + 33] = meta.isWritable ? 1 : 0;
    });
    return buf;
  };

  before(async () => {
    [vaultPDA] = await PublicKey.findProgramAddress(
      [Buffer.from("vault"), wallet.publicKey.toBuffer()],
      program.programId
    );
    [policyPDA] = await PublicKey.findProgramAddress(
      [Buffer.from("policy"), vaultPDA.toBuffer()],
      program.programId
    );
    [pendingActionPDA] = await PublicKey.findProgramAddress(
      [Buffer.from("pending_action"), vaultPDA.toBuffer(), Buffer.from([0])],
      program.programId
    );

    mintA = await createMint(connection, payer, payer.publicKey, null, 6);
    mintB = await createMint(connection, payer, payer.publicKey, null, 6);
    if (mintA.toBuffer().compare(mintB.toBuffer()) > 0) {
      [mintA, mintB] = [mintB, mintA];
    }

    const vaultSourceKp = anchor.web3.Keypair.generate();
    const vaultDestKp = anchor.web3.Keypair.generate();
    vaultSource = await createAccount(connection, payer, mintA, vaultPDA, vaultSourceKp);
    vaultDestination = await createAccount(connection, payer, mintA, vaultPDA, vaultDestKp);
    userReceive = await createAccount(connection, payer, mintA, payer.publicKey);

    await mintTo(connection, payer, mintA, vaultSource, payer.publicKey, 2_000_000);

    // Derive AMM PDAs
    [poolPda] = await PublicKey.findProgramAddress(
      [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
      program.programId
    );
    [poolVaultA] = await PublicKey.findProgramAddress(
      [Buffer.from("pool_vault"), poolPda.toBuffer(), mintA.toBuffer()],
      program.programId
    );
    [poolVaultB] = await PublicKey.findProgramAddress(
      [Buffer.from("pool_vault"), poolPda.toBuffer(), mintB.toBuffer()],
      program.programId
    );
    [lpMint] = await PublicKey.findProgramAddress(
      [Buffer.from("lp_mint"), poolPda.toBuffer()],
      program.programId
    );
    [oracleConfig] = await PublicKey.findProgramAddress(
      [Buffer.from("oracle"), poolPda.toBuffer()],
      program.programId
    );
  });

  it("initializes vault and policy", async () => {
    await program.methods
      .initializeVault(dailySpendLimit, largeTxThreshold, allowedPrograms)
      .accounts({
        owner: wallet.publicKey,
        authority: wallet.publicKey,
        vault: vaultPDA,
        policy: policyPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const policy = await program.account.policy.fetch(policyPDA);
    expect(policy.dailySpendLimitLamports.toNumber()).to.equal(dailySpendLimit.toNumber());
  });

  it("executes immediate swap via token-program CPI", async () => {
    const amountIn = new BN(200_000);
    const amountOutMin = new BN(150_000);

    const ix = createTransferInstruction(
      vaultSource,
      vaultDestination,
      vaultPDA,
      amountIn.toNumber()
    );

    const jupiterAccounts = encodeMetas(ix);
    const jupiterData = ix.data;

    await program.methods
      .requestSwapJupiter(amountIn, amountOutMin, jupiterAccounts, jupiterData)
      .accounts({
        authority: wallet.publicKey,
        vault: vaultPDA,
        policy: policyPDA,
        pendingAction: null,
        sourceTokenAccount: vaultSource,
        destinationTokenAccount: vaultDestination,
        jupiterProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([])
      .rpc();

    const dest = await getAccount(connection, vaultDestination);
    expect(Number(dest.amount)).to.equal(amountIn.toNumber());

    const vaultAccount = await program.account.vault.fetch(vaultPDA);
    expect(vaultAccount.dailySpent.toNumber()).to.equal(amountIn.toNumber());
  });

  it("creates and approves pending action for large swap", async () => {
    const amountIn = new BN(600_000);
    const amountOutMin = new BN(1);

    // top-up source to ensure balance
    await mintTo(connection, payer, mintA, vaultSource, payer.publicKey, 1_000_000);

    const ix = createTransferInstruction(
      vaultSource,
      vaultDestination,
      vaultPDA,
      amountIn.toNumber()
    );
    const jupiterAccounts = encodeMetas(ix);
    const jupiterData = ix.data;

    await program.methods
      .requestSwapJupiter(amountIn, amountOutMin, jupiterAccounts, jupiterData)
      .accounts({
        authority: wallet.publicKey,
        vault: vaultPDA,
        policy: policyPDA,
        pendingAction: pendingActionPDA,
        sourceTokenAccount: vaultSource,
        destinationTokenAccount: vaultDestination,
        jupiterProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const pending = await program.account.pendingAction.fetch(pendingActionPDA);
    expect(pending.status.pending).to.be.true;

    await program.methods
      .approvePendingAction()
      .accounts({
        owner: wallet.publicKey,
        vault: vaultPDA,
        pendingAction: pendingActionPDA,
        policy: policyPDA,
        sourceTokenAccount: vaultSource,
        destinationTokenAccount: vaultDestination,
        jupiterProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([])
      .rpc();

    const dest = await getAccount(connection, vaultDestination);
    expect(Number(dest.amount)).to.be.greaterThan(0);

    const vaultAfter = await program.account.vault.fetch(vaultPDA);
    expect(vaultAfter.pendingActionsCount).to.equal(0);
  });

  it("initializes pool and runs AMM flows", async () => {
    // Fund user tokens
    userTokenA = await createAccount(connection, payer, mintA, payer.publicKey);
    userTokenB = await createAccount(connection, payer, mintB, payer.publicKey);
    await mintTo(connection, payer, mintA, userTokenA, payer.publicKey, 1_000_000);
    await mintTo(connection, payer, mintB, userTokenB, payer.publicKey, 1_000_000);

    await program.methods
      .initializePool(30) // 0.3% fee
      .accounts({
        payer: wallet.publicKey,
        mintA,
        mintB,
        pool: poolPda,
        vaultA: poolVaultA,
        vaultB: poolVaultB,
        lpMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    await program.methods
      .configureOracle({ manual: {} }, PublicKey.default, PublicKey.default, new BN(0))
      .accounts({
        payer: wallet.publicKey,
        pool: poolPda,
        oracleConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .updateOracleManual(new BN(1_000_000), -6, new BN(1_000_000), -6)
      .accounts({
        oracleConfig,
        authority: wallet.publicKey,
        pool: poolPda,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .rpc();

    userLpToken = await createAccount(connection, payer, lpMint, payer.publicKey);

    await program.methods
      .addLiquidity(new BN(200_000), new BN(200_000))
      .accounts({
        user: wallet.publicKey,
        pool: poolPda,
        vaultA: poolVaultA,
        vaultB: poolVaultB,
        lpMint,
        userTokenA,
        userTokenB,
        userLpToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const poolAccount = await program.account.pool.fetch(poolPda);
    expect(poolAccount.lpSupply.toNumber()).to.be.greaterThan(0);

    await program.methods
      .swap(new BN(50_000), new BN(1), true)
      .accounts({
        user: wallet.publicKey,
        pool: poolPda,
        vaultA: poolVaultA,
        vaultB: poolVaultB,
        userSource: userTokenA,
        userDestination: userTokenB,
        swapSourceMint: mintA,
        swapDestinationMint: mintB,
        oracleConfig,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await program.methods
      .removeLiquidity(new BN(poolAccount.lpSupply / 2))
      .accounts({
        user: wallet.publicKey,
        pool: poolPda,
        vaultA: poolVaultA,
        vaultB: poolVaultB,
        lpMint,
        userLpToken,
        userTokenA,
        userTokenB,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

      const lpAfter = await getAccount(connection, userLpToken);
    expect(Number(lpAfter.amount)).to.be.greaterThan(0);
  });

  it("configures oracle for pool", async () => {
    [oracleConfigPDA] = await PublicKey.findProgramAddress(
      [Buffer.from("oracle"), poolPda.toBuffer()],
      program.programId
    );

    // Configure manual oracle for testing
    await program.methods
      .configureOracle(
        { manual: {} }, // OracleType.Manual
        mintA, // feed_a (placeholder)
        mintB, // feed_b (placeholder)
        new BN(300), // max_staleness_seconds
      )
      .accounts({
        payer: wallet.publicKey,
        pool: poolPda,
        oracleConfig: oracleConfigPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const oracle = await program.account.oracleConfig.fetch(oracleConfigPDA);
    expect(oracle.oracleType.manual).to.be.true;
    expect(oracle.maxStalenessSeconds.toNumber()).to.equal(300);
  });

  it("updates oracle prices manually", async () => {
    const priceA = new BN(1000000); // $1.00 with 6 decimals
    const expoA = -6;
    const priceB = new BN(2000000); // $2.00 with 6 decimals
    const expoB = -6;

    await program.methods
      .updateOracleManual(priceA, expoA, priceB, expoB)
      .accounts({
        oracleConfig: oracleConfigPDA,
        authority: wallet.publicKey,
        pool: poolPda,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .rpc();

    const oracle = await program.account.oracleConfig.fetch(oracleConfigPDA);
    expect(oracle.priceA.toNumber()).to.equal(priceA.toNumber());
    expect(oracle.priceB.toNumber()).to.equal(priceB.toNumber());
  });

  it("validates oracle price integration in operations", async () => {
    // Test that operations requiring oracle prices work correctly
    // This is a placeholder - actual implementation would validate price feeds
    const oracle = await program.account.oracleConfig.fetch(oracleConfigPDA);
    expect(oracle.priceA.toNumber()).to.be.greaterThan(0);
    expect(oracle.priceB.toNumber()).to.be.greaterThan(0);
  });
});