/**
 * Script simples para testar criação de pool usando Anchor
 */

const anchor = require("@coral-xyz/anchor");
const { SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint, mintTo, getOrCreateAssociatedTokenAccount } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// Carregar IDL
const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../idl/aegis_protocol.json"), "utf8"));

async function main() {
  console.log("=== Teste Simples de Criação de Pool com Anchor ===\n");

  // Configurar provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const programId = new anchor.web3.PublicKey(idl.address);
  console.log(`Program ID: ${programId.toString()}`);
  console.log(`Wallet: ${provider.wallet.publicKey.toString()}\n`);

  // Verificar saldo
  const balance = await provider.connection.getBalance(provider.wallet.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL\n`);

  if (balance < 0.1 * 1e9) {
    console.error("Saldo insuficiente! Execute:");
    console.error(`solana airdrop 2 ${provider.wallet.publicKey.toString()} --url devnet`);
    process.exit(1);
  }

  // Criar o Program
  const program = new anchor.Program(idl, programId, provider);

  console.log("=== Criando Tokens de Teste ===\n");

  // Criar tokens
  const payer = provider.wallet.payer;
  const mintA = await createMint(
    provider.connection,
    payer,
    payer.publicKey,
    null,
    6
  );
  console.log(`✅ Token A: ${mintA.toString()}`);

  const mintB = await createMint(
    provider.connection,
    payer,
    payer.publicKey,
    null,
    6
  );
  console.log(`✅ Token B: ${mintB.toString()}\n`);

  // Ordenar mints
  const [sortedMintA, sortedMintB] = mintA.toBuffer().compare(mintB.toBuffer()) < 0
    ? [mintA, mintB]
    : [mintB, mintA];

  console.log("Mints ordenados:");
  console.log(`  Mint A (menor): ${sortedMintA.toString()}`);
  console.log(`  Mint B (maior): ${sortedMintB.toString()}\n`);

  // Derivar PDAs
  const [poolPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), sortedMintA.toBuffer(), sortedMintB.toBuffer()],
    programId
  );
  
  const [vaultA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolPda.toBuffer(), sortedMintA.toBuffer()],
    programId
  );
  
  const [vaultB] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolPda.toBuffer(), sortedMintB.toBuffer()],
    programId
  );
  
  const [lpMint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("lp_mint"), poolPda.toBuffer()],
    programId
  );

  console.log("PDAs:");
  console.log(`  Pool: ${poolPda.toString()}`);
  console.log(`  Vault A: ${vaultA.toString()}`);
  console.log(`  Vault B: ${vaultB.toString()}`);
  console.log(`  LP Mint: ${lpMint.toString()}\n`);

  // Verificar se pool já existe
  const existingPool = await provider.connection.getAccountInfo(poolPda);
  if (existingPool) {
    console.log("⚠️  Pool já existe! Usando pool existente.\n");
  } else {
    console.log("=== Inicializando Pool ===\n");

    try {
      const tx = await program.methods
        .initializePool(30) // 0.3% fee
        .accounts({
          payer: provider.wallet.publicKey,
          mintA: sortedMintA,
          mintB: sortedMintB,
          pool: poolPda,
          vaultA,
          vaultB,
          lpMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log(`✅ Pool criada! TX: ${tx}\n`);
      
      // Aguardar confirmação
      await provider.connection.confirmTransaction(tx, "confirmed");
    } catch (error) {
      console.error("❌ Erro ao criar pool:");
      console.error(error);
      
      if (error.logs) {
        console.error("\nLogs:");
        error.logs.forEach(log => console.error(`  ${log}`));
      }
      
      process.exit(1);
    }
  }

  // Mintar tokens
  console.log("=== Mintando Tokens ===\n");

  const userTokenA = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    sortedMintA,
    payer.publicKey
  );
  await mintTo(
    provider.connection,
    payer,
    sortedMintA,
    userTokenA.address,
    payer,
    1_000_000_000_000
  );
  console.log(`✅ Mintado Token A`);

  const userTokenB = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    sortedMintB,
    payer.publicKey
  );
  await mintTo(
    provider.connection,
    payer,
    sortedMintB,
    userTokenB.address,
    payer,
    1_000_000_000_000
  );
  console.log(`✅ Mintado Token B\n`);

  // Adicionar liquidez
  console.log("=== Adicionando Liquidez ===\n");

  const userLpToken = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    lpMint,
    payer.publicKey
  );

  const amountA = new anchor.BN(100_000_000_000); // 100k
  const amountB = new anchor.BN(100_000_000_000); // 100k

  console.log(`Amount A: ${amountA.toString()}`);
  console.log(`Amount B: ${amountB.toString()}\n`);

  try {
    const tx = await program.methods
      .addLiquidity(amountA, amountB)
      .accounts({
        user: provider.wallet.publicKey,
        pool: poolPda,
        vaultA,
        vaultB,
        lpMint,
        userTokenA: userTokenA.address,
        userTokenB: userTokenB.address,
        userLpToken: userLpToken.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`✅ Liquidez adicionada! TX: ${tx}\n`);
    
    await provider.connection.confirmTransaction(tx, "confirmed");

    // Verificar estado
    const poolAccount = await program.account.pool.fetch(poolPda);
    console.log("=== Estado da Pool ===");
    console.log(`  LP Supply: ${poolAccount.lpSupply.toString()}`);
    console.log(`  Fee BPS: ${poolAccount.feeBps}`);
    console.log(`  Swap Count: ${poolAccount.swapCount}`);
    console.log(`  Creator: ${poolAccount.creator.toString()}\n`);

    console.log("✅ Teste concluído com sucesso!");
    console.log("\n📝 Informações:");
    console.log(`  Token A: ${sortedMintA.toString()}`);
    console.log(`  Token B: ${sortedMintB.toString()}`);
    console.log(`  Pool: ${poolPda.toString()}`);

  } catch (error) {
    console.error("❌ Erro ao adicionar liquidez:");
    console.error(error);
    
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach(log => console.error(`  ${log}`));
    }
    
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro fatal:");
  console.error(err);
  process.exit(1);
});
