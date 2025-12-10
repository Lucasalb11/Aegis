import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const idl = require("../idl/aegis_protocol.json");
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Helpers
const ensureAirdrop = async (connection: Connection, pubkey: PublicKey, amount: number) => {
  const sig = await connection.requestAirdrop(pubkey, amount);
  await connection.confirmTransaction(sig, "confirmed");
};

const lexSortMints = (a: PublicKey, b: PublicKey) => {
  return Buffer.compare(a.toBuffer(), b.toBuffer()) < 0 ? [a, b] : [b, a];
};

const computeAmountOut = (amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps: number) => {
  const amountInAfterFee = (amountIn * BigInt(10_000 - feeBps)) / BigInt(10_000);
  const newReserveIn = reserveIn + amountInAfterFee;
  const k = reserveIn * reserveOut;
  const newReserveOut = k / newReserveIn;
  return reserveOut - newReserveOut;
};

describe("pools (Orca-style AMM)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection as Connection;
  const walletKp = (provider.wallet as any).payer as Keypair;

  const program = new Program(idl as anchor.Idl, provider);
  const programId = program.programId;

  const feeBps = 30; // 0.30%
  const mintDecimals = 6;

  let mintA: PublicKey;
  let mintB: PublicKey;
  let poolPda: PublicKey;
  let vaultA: PublicKey;
  let vaultB: PublicKey;
  let lpMint: PublicKey;
  let oracleConfig: PublicKey;
  let userTokenA: PublicKey;
  let userTokenB: PublicKey;
  let userLpToken: PublicKey;

  before("set up mints, PDAs and pool", async () => {
    // Fund wallet for test operations
    await ensureAirdrop(connection, walletKp.publicKey, 2 * LAMPORTS_PER_SOL);

    // Create two fresh SPL mints
    const createdMintA = await createMint(
      connection,
      walletKp,
      walletKp.publicKey,
      null,
      mintDecimals
    );
    const createdMintB = await createMint(
      connection,
      walletKp,
      walletKp.publicKey,
      null,
      mintDecimals
    );
    [mintA, mintB] = lexSortMints(createdMintA, createdMintB);

    // Derive pool and vault PDAs
    [poolPda] = await PublicKey.findProgramAddress(
      [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
      program.programId
    );
    [vaultA] = await PublicKey.findProgramAddress(
      [Buffer.from("pool_vault"), poolPda.toBuffer(), mintA.toBuffer()],
      program.programId
    );
    [vaultB] = await PublicKey.findProgramAddress(
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

    // Create user token accounts
    const ataA = await getOrCreateAssociatedTokenAccount(
      connection,
      walletKp,
      mintA,
      walletKp.publicKey
    );
    const ataB = await getOrCreateAssociatedTokenAccount(
      connection,
      walletKp,
      mintB,
      walletKp.publicKey
    );
    const ataLp = await getOrCreateAssociatedTokenAccount(
      connection,
      walletKp,
      lpMint,
      walletKp.publicKey
    );
    userTokenA = ataA.address;
    userTokenB = ataB.address;
    userLpToken = ataLp.address;

    // Mint initial balances to user
    await mintTo(connection, walletKp, mintA, userTokenA, walletKp.publicKey, 1_000_000_000n);
    await mintTo(connection, walletKp, mintB, userTokenB, walletKp.publicKey, 1_000_000_000n);

    // Initialize pool
    await program.methods
      .initializePool(feeBps)
      .accounts({
        payer: walletKp.publicKey,
        mintA,
        mintB,
        pool: poolPda,
        vaultA,
        vaultB,
        lpMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([walletKp])
      .rpc();

    await program.methods
      .configureOracle({ manual: {} }, PublicKey.default, PublicKey.default, new anchor.BN(0))
      .accounts({
        payer: walletKp.publicKey,
        pool: poolPda,
        oracleConfig,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKp])
      .rpc();

    await program.methods
      .updateOracleManual(new anchor.BN(1_000_000), -6, new anchor.BN(1_000_000), -6)
      .accounts({
        oracleConfig,
        authority: walletKp.publicKey,
        pool: poolPda,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .signers([walletKp])
      .rpc();
  });

  it("initializes pool state correctly", async () => {
    const pool = await program.account.pool.fetch(poolPda);
    expect(pool.mintA.toBase58()).to.equal(mintA.toBase58());
    expect(pool.mintB.toBase58()).to.equal(mintB.toBase58());
    expect(pool.vaultA.toBase58()).to.equal(vaultA.toBase58());
    expect(pool.vaultB.toBase58()).to.equal(vaultB.toBase58());
    expect(pool.lpMint.toBase58()).to.equal(lpMint.toBase58());
    expect(pool.feeBps).to.equal(feeBps);
    expect(pool.lpSupply.toNumber()).to.equal(0);
  });

  it("adds initial liquidity and mints LP", async () => {
    const depositA = new anchor.BN(500_000_000); // 500 tokens
    const depositB = new anchor.BN(500_000_000);

    await program.methods
      .addLiquidity(depositA, depositB)
      .accounts({
        user: walletKp.publicKey,
        pool: poolPda,
        vaultA,
        vaultB,
        lpMint,
        userTokenA,
        userTokenB,
        userLpToken,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([walletKp])
      .rpc();

    const vaultAAccount = await getAccount(connection, vaultA);
    const vaultBAccount = await getAccount(connection, vaultB);
    const lpMintInfo = await getMint(connection, lpMint);

    expect(Number(vaultAAccount.amount)).to.equal(depositA.toNumber());
    expect(Number(vaultBAccount.amount)).to.equal(depositB.toNumber());
    expect(Number(lpMintInfo.supply)).to.be.greaterThan(0);
  });

  it("performs swap A -> B respecting fee and slippage", async () => {
    const amountIn = new anchor.BN(100_000); // 0.1 token

    const vaultAAccount = await getAccount(connection, vaultA);
    const vaultBAccount = await getAccount(connection, vaultB);
    const expectedOut = computeAmountOut(
      BigInt(amountIn.toNumber()),
      BigInt(vaultAAccount.amount),
      BigInt(vaultBAccount.amount),
      feeBps
    );
    const minOut = new anchor.BN((expectedOut * 99n) / 100n); // 1% slippage tolerance

    const destBefore = await getAccount(connection, userTokenB);

    await program.methods
      .swap(amountIn, minOut, true)
      .accounts({
        user: walletKp.publicKey,
        pool: poolPda,
        vaultA,
        vaultB,
        userSource: userTokenA,
        userDestination: userTokenB,
        swapSourceMint: mintA,
        swapDestinationMint: mintB,
        oracleConfig,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([walletKp])
      .rpc();

    const destAfter = await getAccount(connection, userTokenB);
    const received = BigInt(destAfter.amount) - BigInt(destBefore.amount);

    expect(received >= BigInt(minOut.toNumber())).to.be.true;
  });

  it("removes liquidity proportionally", async () => {
    const lpMintInfo = await getMint(connection, lpMint);
    const burnAmount = new anchor.BN(Number(lpMintInfo.supply) / 2); // remove half

    const userLpBefore = await getAccount(connection, userLpToken);
    const userABefore = await getAccount(connection, userTokenA);
    const userBBefore = await getAccount(connection, userTokenB);

    await program.methods
      .removeLiquidity(burnAmount)
      .accounts({
        user: walletKp.publicKey,
        pool: poolPda,
        vaultA,
        vaultB,
        lpMint,
        userLpToken,
        userTokenA,
        userTokenB,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([walletKp])
      .rpc();

    const userLpAfter = await getAccount(connection, userLpToken);
    const userAAfter = await getAccount(connection, userTokenA);
    const userBAfter = await getAccount(connection, userTokenB);

    expect(BigInt(userLpBefore.amount) - BigInt(userLpAfter.amount)).to.equal(BigInt(burnAmount.toNumber()));
    expect(userAAfter.amount).to.be.greaterThan(userABefore.amount);
    expect(userBAfter.amount).to.be.greaterThan(userBBefore.amount);
  });
});
