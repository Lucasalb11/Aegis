const fs = require("fs");
const path = require("path");
const anchor = require("@coral-xyz/anchor");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const idl = require("../../program/idl/aegis_protocol.json");

function loadKeypair(filePath) {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

function sortMints(a, b) {
  return a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
}

async function main() {
  console.log("\n🏊 Aegis Protocol - Create Pools\n");
  console.log("=".repeat(60));

  const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const treasuryPath = process.env.TREASURY_KEYPAIR_PATH || path.join(__dirname, "../../.secrets/devnet/treasury.json");
  const tokensPath = process.env.TOKENS_CONFIG_PATH || path.join(__dirname, "../config/devnet.tokens.json");

  const treasury = loadKeypair(treasuryPath);
  const connection = new Connection(RPC, "confirmed");
  
  console.log(`🔗 RPC: ${RPC}`);
  console.log(`👛 Treasury: ${treasury.publicKey.toString()}`);
  
  const balance = await connection.getBalance(treasury.publicKey);
  console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(treasury),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const programId = new PublicKey(idl.address);
  // Use full IDL without coder to avoid getCustomResolver error
  const program = new anchor.Program(idl, programId, provider);

  // Load tokens
  const tokensData = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
  const tokens = tokensData.tokens || tokensData;

  console.log(`📋 Loaded ${tokens.length} tokens\n`);

  // Use AEGIS as base token
  const baseToken = tokens.find((t) => t.symbol === "AEGIS");
  if (!baseToken) {
    throw new Error("AEGIS token not found");
  }

  const baseTokenMint = new PublicKey(baseToken.mint);
  const otherTokens = tokens.filter(
    (t) =>
      t.symbol !== "AEGIS" &&
      t.mint !== "So1111111111111111111111111111111112" &&
      t.mint !== "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );

  console.log(`🎯 Base token: AEGIS (${baseTokenMint.toString()})\n`);
  console.log(`📦 Creating pools for ${otherTokens.length} tokens:\n`);

  const feeBps = parseInt(process.env.FEE_BPS || "30");
  const liquidityAmount = parseFloat(process.env.INITIAL_LIQUIDITY_USD_EQUIV || "1000");

  for (const token of otherTokens) {
    try {
      const tokenMint = new PublicKey(token.mint);
      const [mintA, mintB] = sortMints(baseTokenMint, tokenMint);

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
        programId
      );

      // Check if pool exists
      try {
        const poolAccount = await connection.getAccountInfo(poolPda);
        if (poolAccount) {
          console.log(`  ⏭️  Pool AEGIS/${token.symbol} already exists, skipping...\n`);
          continue;
        }
      } catch {}

      const [vaultA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_vault"), poolPda.toBuffer(), mintA.toBuffer()],
        programId
      );
      const [vaultB] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_vault"), poolPda.toBuffer(), mintB.toBuffer()],
        programId
      );
      const [lpMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), poolPda.toBuffer()],
        programId
      );

      console.log(`  🏊 Creating pool AEGIS/${token.symbol}...`);

      // Initialize pool
      await program.methods
        .initializePool(feeBps)
        .accounts({
          payer: treasury.publicKey,
          mintA,
          mintB,
          pool: poolPda,
          vaultA,
          vaultB,
          lpMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([treasury])
        .rpc();

      console.log(`    ✅ Pool created: ${poolPda.toString()}`);

      // Add liquidity
      const amountA = Math.floor(liquidityAmount * Math.pow(10, baseToken.decimals));
      const amountB = Math.floor(liquidityAmount * Math.pow(10, token.decimals));

      const userTokenA = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mintA,
        treasury.publicKey
      );
      const userTokenB = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mintB,
        treasury.publicKey
      );
      const userLp = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        lpMint,
        treasury.publicKey
      );

      // Check balances
      const balanceA = await getAccount(connection, userTokenA.address).catch(() => null);
      const balanceB = await getAccount(connection, userTokenB.address).catch(() => null);

      if (!balanceA || Number(balanceA.amount) < amountA) {
        console.log(`    ⚠️  Insufficient AEGIS: need ${amountA}, have ${balanceA?.amount.toString() || "0"}\n`);
        continue;
      }
      if (!balanceB || Number(balanceB.amount) < amountB) {
        console.log(`    ⚠️  Insufficient ${token.symbol}: need ${amountB}, have ${balanceB?.amount.toString() || "0"}\n`);
        continue;
      }

      console.log(`    💧 Adding liquidity: ${amountA} AEGIS / ${amountB} ${token.symbol}`);

      await program.methods
        .addLiquidity(
          new anchor.BN(amountA.toString()),
          new anchor.BN(amountB.toString())
        )
        .accounts({
          user: treasury.publicKey,
          pool: poolPda,
          vaultA,
          vaultB,
          lpMint,
          userTokenA: userTokenA.address,
          userTokenB: userTokenB.address,
          userLpToken: userLp.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([treasury])
        .rpc();

      console.log(`    ✅ Liquidity added!\n`);

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`    ❌ Error: ${error.message}\n`);
    }
  }

  console.log("=".repeat(60));
  console.log("✅ Pool creation completed!\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
