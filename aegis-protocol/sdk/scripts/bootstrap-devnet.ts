import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
} from "@solana/spl-token";

type MintInfo = {
  symbol: string;
  mint: PublicKey;
  vaultAta: PublicKey;
};

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function ensureBalance(
  connection: Connection,
  payer: Keypair,
  minSol: number,
) {
  const balance = await connection.getBalance(payer.publicKey);
  if (balance >= minSol * LAMPORTS_PER_SOL) {
    return;
  }

  const shortfall = minSol * LAMPORTS_PER_SOL - balance;
  try {
    const airdropSig = await connection.requestAirdrop(
      payer.publicKey,
      shortfall,
    );
    await connection.confirmTransaction(airdropSig, "confirmed");
  } catch (err) {
    throw new Error(
      `Airdrop failed for ${payer.publicKey.toBase58()}. Fund this account on devnet manually. Original error: ${String(
        err,
      )}`,
    );
  }
}

async function main() {
  const RPC =
    process.env.AEGIS_RPC_ENDPOINT || "https://api.devnet.solana.com";
  const DECIMALS = 6;
  const TOTAL_SUPPLY_RAW = BigInt(1_000_000) * 10n ** BigInt(DECIMALS);
  const DISTRIBUTION_PCT = 10n; // 10% leaves 90% in the vault owner

  const secretsDir = path.resolve(__dirname, "../../.secrets/devnet");
  const accountsDir = path.join(secretsDir, "accounts");

  const deployer = loadKeypair(path.join(secretsDir, "deployer.json"));
  const mintAuthority = loadKeypair(
    path.join(secretsDir, "mint-authority.json"),
  );
  const vaultOwner = loadKeypair(path.join(secretsDir, "vault-owner.json"));

  const connection = new Connection(RPC, "confirmed");

  // Ensure we have funds to pay for ATAs and mints.
  await ensureBalance(connection, deployer, 5);

  const accountFiles = fs
    .readdirSync(accountsDir)
    .filter((f) => f.endsWith(".json"));
  const holders = accountFiles.map((file) => ({
    file,
    keypair: loadKeypair(path.join(accountsDir, file)),
  }));

  const symbols = ["AEGIS", "AERO", "ABTC", "AUSD", "ASOL"];
  const mintResults: MintInfo[] = [];

  for (const symbol of symbols) {
    console.log(`\nCreating mint for ${symbol}...`);
    const mint = await createMint(
      connection,
      deployer,
      mintAuthority.publicKey,
      null,
      DECIMALS,
    );

    const vaultAta = await getOrCreateAssociatedTokenAccount(
      connection,
      deployer,
      mint,
      vaultOwner.publicKey,
    );

    await mintTo(
      connection,
      deployer,
      mint,
      vaultAta.address,
      mintAuthority,
      Number(TOTAL_SUPPLY_RAW),
    );

    mintResults.push({ symbol, mint, vaultAta: vaultAta.address });

    const distributionTotal =
      (TOTAL_SUPPLY_RAW * DISTRIBUTION_PCT) / 100n; // 100_000 tokens
    const perHolder =
      distributionTotal / BigInt(Math.max(holders.length, 1)); // 2_000 tokens each
    const perHolderNumber = Number(perHolder);

    for (const { keypair, file } of holders) {
      const owner = keypair.publicKey;
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        deployer,
        mint,
        owner,
      );
      await transfer(
        connection,
        deployer,
        vaultAta.address,
        ata.address,
        vaultOwner,
        perHolderNumber,
      );
      console.log(
        `Distributed ${perHolderNumber / 10 ** DECIMALS} ${symbol} to ${
          owner.toBase58()
        } (${file})`,
      );
    }

    console.log(
      `Minted ${symbol}: ${mint.toBase58()} | Vault ATA: ${vaultAta.address.toBase58()}`,
    );
  }

  const output = mintResults.map((m) => ({
    symbol: m.symbol,
    mint: m.mint.toBase58(),
    vaultAta: m.vaultAta.toBase58(),
    decimals: DECIMALS,
    totalSupply: "1_000_000",
    vaultShare: "900_000",
    distributedSharePerAccount: "2_000",
  }));

  const outPath = path.join(secretsDir, "mints.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved mint metadata to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
