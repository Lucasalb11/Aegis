import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  createAccount,
  createMint,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";

// Minimal IDL subset covering tokenomics instructions + pool swap hooks
const TOKENOMICS_IDL: anchor.Idl = {
  version: "0.1.0",
  name: "aegis_protocol",
  instructions: [
    {
      name: "initializePool",
      accounts: [
        { name: "payer", isMut: true, isSigner: true },
        { name: "mintA", isMut: false, isSigner: false },
        { name: "mintB", isMut: false, isSigner: false },
        { name: "pool", isMut: true, isSigner: false },
        { name: "vaultA", isMut: true, isSigner: false },
        { name: "vaultB", isMut: true, isSigner: false },
        { name: "lpMint", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [{ name: "feeBps", type: "u16" }],
    },
    {
      name: "swap",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "pool", isMut: true, isSigner: false },
        { name: "vaultA", isMut: true, isSigner: false },
        { name: "vaultB", isMut: true, isSigner: false },
        { name: "userSource", isMut: true, isSigner: false },
        { name: "userDestination", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "amountIn", type: "u64" },
        { name: "minAmountOut", type: "u64" },
        { name: "aToB", type: "bool" },
      ],
    },
    {
      name: "initializeEmissionVault",
      accounts: [
        { name: "admin", isMut: true, isSigner: true },
        { name: "rewardMinter", isMut: true, isSigner: false },
        { name: "aegisMint", isMut: true, isSigner: true },
        { name: "emissionVault", isMut: true, isSigner: false },
        { name: "emissionTokenAccount", isMut: true, isSigner: false },
        { name: "lmVault", isMut: true, isSigner: false },
        { name: "teamVault", isMut: true, isSigner: false },
        { name: "ecosystemVault", isMut: true, isSigner: false },
        { name: "teamVesting", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "distributeWeeklyRewards",
      accounts: [
        { name: "caller", isMut: false, isSigner: true },
        { name: "emissionVault", isMut: true, isSigner: false },
        { name: "emissionTokenAccount", isMut: true, isSigner: false },
        { name: "lmVault", isMut: true, isSigner: false },
        { name: "teamVault", isMut: true, isSigner: false },
        { name: "ecosystemVault", isMut: true, isSigner: false },
        { name: "aegisMint", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "claimPoolRewards",
      accounts: [
        { name: "caller", isMut: false, isSigner: true },
        { name: "pool", isMut: true, isSigner: false },
        { name: "emissionVault", isMut: false, isSigner: false },
        { name: "lmVault", isMut: true, isSigner: false },
        { name: "aegisMint", isMut: false, isSigner: false },
        { name: "destination", isMut: true, isSigner: false },
        { name: "vaultA", isMut: true, isSigner: false },
        { name: "vaultB", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "pool",
      type: {
        kind: "struct",
        fields: [
          { name: "mintA", type: "publicKey" },
          { name: "mintB", type: "publicKey" },
          { name: "vaultA", type: "publicKey" },
          { name: "vaultB", type: "publicKey" },
          { name: "lpMint", type: "publicKey" },
          { name: "feeBps", type: "u16" },
          { name: "lpSupply", type: "u64" },
          { name: "creator", type: "publicKey" },
          { name: "createdAt", type: "i64" },
          { name: "bump", type: "u8" },
          { name: "vaultABump", type: "u8" },
          { name: "vaultBBump", type: "u8" },
          { name: "lpMintBump", type: "u8" },
          { name: "emergencyMode", type: "bool" },
          { name: "maxDailyVolume", type: "u64" },
          { name: "currentDailyVolume", type: "u64" },
          { name: "lastVolumeReset", type: "i64" },
          { name: "version", type: "u8" },
          { name: "featuresFlags", type: "u32" },
          { name: "rewardPoints", type: "u128" },
          { name: "swapCount", type: "u64" },
          { name: "lastRewardClaimTs", type: "i64" },
          { name: "_reserved", type: { array: ["u8", 32] } },
        ],
      },
    },
    {
      name: "emissionVault",
      type: {
        kind: "struct",
        fields: [
          { name: "bump", type: "u8" },
          { name: "lastDistributionTs", type: "i64" },
          { name: "weekCounter", type: "u32" },
          { name: "totalEmitted", type: "u128" },
          { name: "weeklyAmount", type: "u64" },
          { name: "rewardMint", type: "publicKey" },
          { name: "emissionTokenAccount", type: "publicKey" },
          { name: "lmVault", type: "publicKey" },
          { name: "teamVault", type: "publicKey" },
          { name: "ecosystemVault", type: "publicKey" },
          { name: "_reserved", type: { array: ["u8", 16] } },
        ],
      },
    },
  ],
};

describe("tokenomics", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const programId = new PublicKey("AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu");
  const program = new anchor.Program(
    TOKENOMICS_IDL as anchor.Idl,
    programId,
    provider
  );

  const payer = provider.wallet.payer as anchor.web3.Keypair;

  // PDA helpers
  const findPda = (seeds: (Buffer | Uint8Array)[]) =>
    PublicKey.findProgramAddressSync(seeds, program.programId)[0];

  const rewardMinter = findPda([Buffer.from("reward_minter")]);
  const emissionVault = findPda([Buffer.from("emission_vault")]);
  const emissionTokenAccount = findPda([Buffer.from("emission_token_account")]);
  const lmVault = findPda([Buffer.from("lm_vault")]);
  const teamVault = findPda([Buffer.from("team_vault")]);
  const ecosystemVault = findPda([Buffer.from("ecosystem_vault")]);
  const teamVesting = findPda([Buffer.from("team_vesting")]);

  const warpOneWeek = async () => {
    const current = await provider.connection.getSlot();
    await provider.connection._rpcRequest("warpSlot", [current + 1_600_000]);
  };

  let aegisMint: Keypair;
  let pool: PublicKey;
  let poolVaultA: PublicKey;
  let poolVaultB: PublicKey;
  let lpMint: PublicKey;
  let userSource: PublicKey;
  let userDestination: PublicKey;
  let userAegisAta: PublicKey;

  before("setup mints and emission vault", async () => {
    aegisMint = Keypair.generate();

    await program.methods
      .initializeEmissionVault()
      .accounts({
        admin: payer.publicKey,
        rewardMinter,
        aegisMint: aegisMint.publicKey,
        emissionVault,
        emissionTokenAccount,
        lmVault,
        teamVault,
        ecosystemVault,
        teamVesting,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([aegisMint, payer])
      .rpc();

    const vaultAccount = await program.account.emissionVault.fetch(emissionVault);
    expect(vaultAccount.weekCounter.toNumber()).to.equal(0);
    expect(vaultAccount.rewardMint.toBase58()).to.equal(aegisMint.publicKey.toBase58());
  });

  it("distributes weekly rewards over three weeks", async () => {
    for (let i = 0; i < 3; i++) {
      await program.methods
        .distributeWeeklyRewards()
        .accounts({
          caller: payer.publicKey,
          emissionVault,
          emissionTokenAccount,
          lmVault,
          teamVault,
          ecosystemVault,
          aegisMint: aegisMint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc();

      const vaultState = await program.account.emissionVault.fetch(emissionVault);
      expect(vaultState.weekCounter.toNumber()).to.equal(i + 1);

      if (i < 2) {
        await warpOneWeek();
      }
    }
  });

  it("mints reward points on swaps and allows claiming", async () => {
    const mintA = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6
    );
    const mintB = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6
    );

    [pool] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
      program.programId
    );
    poolVaultA = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), pool.toBuffer(), mintA.toBuffer()],
      program.programId
    )[0];
    poolVaultB = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), pool.toBuffer(), mintB.toBuffer()],
      program.programId
    )[0];
    lpMint = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_mint"), pool.toBuffer()],
      program.programId
    )[0];

    const userTokenA = await createAccount(
      provider.connection,
      payer,
      mintA,
      payer.publicKey
    );
    const userTokenB = await createAccount(
      provider.connection,
      payer,
      mintB,
      payer.publicKey
    );
    userSource = userTokenA;
    userDestination = userTokenB;

    await program.methods
      .initializePool(new BN(30))
      .accounts({
        payer: payer.publicKey,
        mintA,
        mintB,
        pool,
        vaultA: poolVaultA,
        vaultB: poolVaultB,
        lpMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([payer])
      .rpc();

    await program.methods
      .swap(new BN(500_000_000), new BN(1), true)
      .accounts({
        user: payer.publicKey,
        pool,
        vaultA: poolVaultA,
        vaultB: poolVaultB,
        userSource,
        userDestination,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();

    await warpOneWeek();
    await program.methods
      .distributeWeeklyRewards()
      .accounts({
        caller: payer.publicKey,
        emissionVault,
        emissionTokenAccount,
        lmVault,
        teamVault,
        ecosystemVault,
        aegisMint: aegisMint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    userAegisAta = await createAccount(
      provider.connection,
      payer,
      aegisMint.publicKey,
      payer.publicKey
    );

    const preBalance = await getAccount(provider.connection, userAegisAta);

    await program.methods
      .claimPoolRewards()
      .accounts({
        caller: payer.publicKey,
        pool,
        emissionVault,
        lmVault,
        aegisMint: aegisMint.publicKey,
        destination: userAegisAta,
        vaultA: poolVaultA,
        vaultB: poolVaultB,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();

    const postBalance = await getAccount(provider.connection, userAegisAta);
    expect(postBalance.amount > preBalance.amount).to.be.true;
  });

  it("rejects double distributions without cooldown", async () => {
    await expect(
      program.methods
        .distributeWeeklyRewards()
        .accounts({
          caller: payer.publicKey,
          emissionVault,
          emissionTokenAccount,
          lmVault,
          teamVault,
          ecosystemVault,
          aegisMint: aegisMint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc()
    ).to.be.rejected;
  });
});
