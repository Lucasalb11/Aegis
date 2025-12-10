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
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  transfer,
} = require("@solana/spl-token");

const idl = require("../idl/aegis_protocol.json");

function loadKeypair(filePath) {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

function loadMints(secretsDir) {
  const file = path.join(secretsDir, "mints.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return parsed.map((m) => ({
    ...m,
    mint: new PublicKey(m.mint),
    vaultAta: new PublicKey(m.vaultAta),
    decimals: m.decimals ?? 6,
  }));
}

function mintMap(mints) {
  return Object.fromEntries(mints.map((m) => [m.symbol, m]));
}

function sortMints(a, b) {
  return a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
}

function randomFraction(min = 0.15, max = 0.35) {
  return min + Math.random() * (max - min);
}

async function consolidateToVaultOwner(connection, vaultOwner, accountsDir, mints) {
  const accountFiles = fs.readdirSync(accountsDir).filter((f) => f.endsWith(".json"));

  for (const mint of mints) {
    const destAta = await getOrCreateAssociatedTokenAccount(
      connection,
      vaultOwner,
      mint.mint,
      vaultOwner.publicKey,
    );

    for (const file of accountFiles) {
      const kp = loadKeypair(path.join(accountsDir, file));
      const srcAta = await getAssociatedTokenAddress(mint.mint, kp.publicKey);
      try {
        const srcAccount = await getAccount(connection, srcAta);
        const amount = srcAccount.amount;
        if (amount > BigInt(0)) {
          await transfer(
            connection,
            vaultOwner,
            srcAta,
            destAta.address,
            kp,
            Number(amount),
          );
        }
      } catch (err) {
        if (!/Failed to find account|could not find/.test(String(err))) {
          console.warn(`Transfer error (${file}, ${mint.symbol}):`, err);
        }
      }
    }
  }
}

async function main() {
  const RPC = process.env.AEGIS_RPC_ENDPOINT || "https://api.devnet.solana.com";
  const secretsDir = path.resolve(__dirname, "../../.secrets/devnet");
  const accountsDir = path.join(secretsDir, "accounts");

  const vaultOwner = loadKeypair(path.join(secretsDir, "vault-owner.json"));
  const mints = loadMints(secretsDir);
  const mintBySymbol = mintMap(mints);

  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(vaultOwner),
    { commitment: "confirmed" },
  );
  anchor.setProvider(provider);

  const programId = new PublicKey(idl.address);
  const slimIdl = { ...idl, accounts: [] };
  const coder = new anchor.BorshCoder(idl);
  const program = new anchor.Program(slimIdl, programId, provider, coder);

  console.log("Consolidating distributed tokens to vault-owner...");
  await consolidateToVaultOwner(connection, vaultOwner, accountsDir, mints);

  const pools = [
    { symbols: ["AEGIS", "AUSD"], feeBps: 30 },
    { symbols: ["AERO", "AUSD"], feeBps: 20 },
    { symbols: ["ABTC", "AUSD"], feeBps: 25 },
    { symbols: ["AEGIS", "ASOL"], feeBps: 35 },
    { symbols: ["ABTC", "ASOL"], feeBps: 40 },
  ];

  const supplyRemaining = {};
  for (const mint of mints) {
    const ata = await getAssociatedTokenAddress(mint.mint, vaultOwner.publicKey);
    const acc = await getAccount(connection, ata);
    supplyRemaining[mint.symbol] = acc.amount;
  }

  const poolsPerMint = {};
  pools.forEach((pool, idx) => {
    pool.symbols.forEach((sym) => {
      if (!poolsPerMint[sym]) poolsPerMint[sym] = [];
      poolsPerMint[sym].push(idx);
    });
  });

  const poolAlloc = {};
  for (const [sym, remaining] of Object.entries(supplyRemaining)) {
    let rem = remaining;
    const poolIdxs = poolsPerMint[sym] || [];
    poolIdxs.forEach((poolIdx, j) => {
      const isLast = j === poolIdxs.length - 1;
      const alloc =
        rem === BigInt(0)
          ? BigInt(0)
          : isLast
            ? rem
            : BigInt(
                Math.max(
                  1,
                  Math.floor(Number(rem) * randomFraction(0.15, 0.35)),
                ),
              );
      rem -= alloc;
      const pool = pools[poolIdx];
      const [symA, symB] = pool.symbols;
      const allocEntry = poolAlloc[poolIdx] ?? { amountA: BigInt(0), amountB: BigInt(0) };
      if (sym === symA) {
        allocEntry.amountA += alloc;
      } else if (sym === symB) {
        allocEntry.amountB += alloc;
      }
      poolAlloc[poolIdx] = allocEntry;
    });
  }

  for (let i = 0; i < pools.length; i++) {
    const { symbols, feeBps } = pools[i];
    const [mintInfoA, mintInfoB] = symbols.map((s) => mintBySymbol[s]);
    const [mintA, mintB] = sortMints(mintInfoA.mint, mintInfoB.mint);

    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
      programId,
    );
    const [vaultA] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolPda.toBuffer(), mintA.toBuffer()],
      programId,
    );
    const [vaultB] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolPda.toBuffer(), mintB.toBuffer()],
      programId,
    );
    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_mint"), poolPda.toBuffer()],
      programId,
    );

    console.log(`\nInitializing pool ${symbols.join("-")} (fee ${feeBps} bps)`);
    await program.methods
      .initializePool(feeBps)
      .accounts({
        payer: vaultOwner.publicKey,
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
      .signers([vaultOwner])
      .rpc();

    const alloc = poolAlloc[i] ?? { amountA: BigInt(0), amountB: BigInt(0) };
    const amountA = alloc.amountA > BigInt(0) ? alloc.amountA : BigInt(1_000_000);
    const amountB = alloc.amountB > BigInt(0) ? alloc.amountB : BigInt(1_000_000);

    const userTokenA = await getOrCreateAssociatedTokenAccount(
      connection,
      vaultOwner,
      mintA,
      vaultOwner.publicKey,
    );
    const userTokenB = await getOrCreateAssociatedTokenAccount(
      connection,
      vaultOwner,
      mintB,
      vaultOwner.publicKey,
    );
    const userLp = await getOrCreateAssociatedTokenAccount(
      connection,
      vaultOwner,
      lpMint,
      vaultOwner.publicKey,
    );

    console.log(
      `Adding liquidity: ${amountA.toString()} (mintA) / ${amountB.toString()} (mintB)`,
    );

    await program.methods
      .addLiquidity(new anchor.BN(amountA.toString()), new anchor.BN(amountB.toString()))
      .accounts({
        user: vaultOwner.publicKey,
        pool: poolPda,
        vaultA,
        vaultB,
        lpMint,
        userTokenA: userTokenA.address,
        userTokenB: userTokenB.address,
        userLpToken: userLp.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([vaultOwner])
      .rpc();
  }

  console.log("\nPools initialized and liquidity added.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
