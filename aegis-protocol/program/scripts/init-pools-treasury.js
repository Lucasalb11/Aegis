const fs = require("fs");
const path = require("path");
const anchor = require("@coral-xyz/anchor");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} = require("@solana/web3.js");
const {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

const idl = require("../idl/aegis_protocol.json");

function loadKeypair(filePath) {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

function sortMints(a, b) {
  return a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
}

async function main() {
  const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  // Try multiple possible paths for treasury
  const possibleTreasuryPaths = [
    path.resolve(__dirname, "../../../.secrets/devnet/treasury.json"),
    path.resolve(__dirname, "../../.secrets/devnet/treasury.json"),
    path.resolve(__dirname, "../../../../.secrets/devnet/treasury.json"),
  ];
  let treasuryPath = possibleTreasuryPaths.find(p => fs.existsSync(p));
  if (!treasuryPath) {
    throw new Error("Treasury keypair not found. Tried: " + possibleTreasuryPaths.join(", "));
  }
  console.log(`Found treasury at: ${treasuryPath}`);
  const tokensPath = path.resolve(__dirname, "../../sdk/config/devnet.tokens.json");

  const treasury = loadKeypair(treasuryPath);
  const tokensData = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
  const tokens = tokensData.tokens || tokensData;

  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(treasury),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const programId = new PublicKey(idl.address);
  // Use full IDL to avoid getCustomResolver error
  const program = new anchor.Program(idl, programId, provider);

  console.log("\n🏊 Creating Pools with Treasury\n");
  console.log("=".repeat(60));
  console.log(`Treasury: ${treasury.publicKey.toString()}`);
  console.log(`Program ID: ${programId.toString()}\n`);

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

  const feeBps = 30;
  const liquidityAmount = 1_000_000; // 1M tokens (with 6 decimals = 1,000,000,000,000)

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
          console.log(`⏭️  Pool AEGIS/${token.symbol} already exists\n`);
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

      console.log(`🏊 Creating pool AEGIS/${token.symbol}...`);

      // Initialize pool
      await program.methods
        .initializePool(feeBps)
        .accounts({
          payer: treasury.publicKey,
          mintA: mintA,
          mintB: mintB,
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

      console.log(`  ✅ Pool created: ${poolPda.toString()}`);

      // Add liquidity
      const amountA = liquidityAmount * Math.pow(10, baseToken.decimals);
      const amountB = liquidityAmount * Math.pow(10, token.decimals);

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
        console.log(`  ⚠️  Insufficient AEGIS: need ${amountA}, have ${balanceA?.amount.toString() || "0"}\n`);
        continue;
      }
      if (!balanceB || Number(balanceB.amount) < amountB) {
        console.log(`  ⚠️  Insufficient ${token.symbol}: need ${amountB}, have ${balanceB?.amount.toString() || "0"}\n`);
        continue;
      }

      console.log(`  💧 Adding liquidity: ${amountA} AEGIS / ${amountB} ${token.symbol}`);

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

      console.log(`  ✅ Liquidity added!\n`);

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }

  console.log("=".repeat(60));
  console.log("✅ Pool creation completed!\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
