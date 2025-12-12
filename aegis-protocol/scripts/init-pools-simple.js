const fs = require("fs");
const path = require("path");
const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, sendAndConfirmTransaction, SystemProgram, SYSVAR_RENT_PUBKEY } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const programId = new PublicKey("AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu");

  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "../.secrets/devnet/admin.json"), "utf8")))
  );

  console.log("Wallet public key:", walletKeypair.publicKey.toString());

  // Token mints from mints.json
  const mints = [
    { symbol: "AEGIS", mint: new PublicKey("GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9") },
    { symbol: "AERO", mint: new PublicKey("DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3") },
    { symbol: "ABTC", mint: new PublicKey("3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc") },
    { symbol: "AUSD", mint: new PublicKey("D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys") },
    { symbol: "ASOL", mint: new PublicKey("7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15") },
  ];

  // Create pools
  const pools = [
    { symbols: ["AEGIS", "AUSD"], feeBps: 30 },
    { symbols: ["AERO", "AUSD"], feeBps: 20 },
    { symbols: ["ABTC", "AUSD"], feeBps: 25 },
    { symbols: ["AEGIS", "ASOL"], feeBps: 35 },
    { symbols: ["ABTC", "ASOL"], feeBps: 40 },
  ];

  console.log("Creating pools...");

  for (const poolConfig of pools) {
    try {
      const mintA = mints.find(m => m.symbol === poolConfig.symbols[0])?.mint;
      const mintB = mints.find(m => m.symbol === poolConfig.symbols[1])?.mint;

      if (!mintA || !mintB) {
        console.error(`Mints not found for pool ${poolConfig.symbols.join('-')}`);
        continue;
      }

      console.log(`Creating pool ${poolConfig.symbols[0]}-${poolConfig.symbols[1]} with fee ${poolConfig.feeBps} bps`);

      // Sort mints for PDA calculation
      const [sortedMintA, sortedMintB] = mintA.toBuffer().compare(mintB.toBuffer()) < 0 ? [mintA, mintB] : [mintB, mintA];

      // Derive PDAs
      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), sortedMintA.toBuffer(), sortedMintB.toBuffer()],
        programId
      );
      const [vaultA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_vault"), poolPda.toBuffer(), sortedMintA.toBuffer()],
        programId
      );
      const [vaultB] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_vault"), poolPda.toBuffer(), sortedMintB.toBuffer()],
        programId
      );
      const [lpMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), poolPda.toBuffer()],
        programId
      );

      console.log(`Pool PDA: ${poolPda.toString()}`);
      console.log(`VaultA: ${vaultA.toString()}`);
      console.log(`VaultB: ${vaultB.toString()}`);
      console.log(`LP Mint: ${lpMint.toString()}`);

      // Create instruction data with correct discriminator
      const data = Buffer.alloc(10); // 8 bytes discriminator + 2 bytes fee
      data.set([95, 180, 10, 172, 84, 174, 232, 40], 0); // discriminator
      data.writeUInt16LE(poolConfig.feeBps, 8); // fee_bps

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: sortedMintA, isSigner: false, isWritable: false },
          { pubkey: sortedMintB, isSigner: false, isWritable: false },
          { pubkey: poolPda, isSigner: false, isWritable: true },
          { pubkey: vaultA, isSigner: false, isWritable: true },
          { pubkey: vaultB, isSigner: false, isWritable: true },
          { pubkey: lpMint, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId,
        data,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = walletKeypair.publicKey;

      const { blockhash } = await connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;

      const signature = await sendAndConfirmTransaction(connection, transaction, [walletKeypair]);

      console.log(`✅ Pool created: ${signature}`);

    } catch (error) {
      console.error(`❌ Failed to create pool ${poolConfig.symbols.join('-')}:`, error);
    }
  }

  console.log("Done!");
}

main().catch(console.error);