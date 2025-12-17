/**
 * Script de teste simplificado usando apenas o SDK do Aegis
 * 
 * Este script testa a criação de pools usando o SDK diretamente,
 * sem depender do Anchor, para isolar problemas no fluxo do frontend.
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { Aegis } from "../src/aegis";
import { Pool } from "../src/pool";
import BN from "bn.js";

// Implementação simples do Wallet
class SimpleWallet {
  constructor(private keypair: Keypair) {}

  get publicKey() {
    return this.keypair.publicKey;
  }

  async signTransaction(tx: any) {
    tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions(txs: any[]) {
    return txs.map((tx) => {
      tx.partialSign(this.keypair);
      return tx;
    });
  }
}

async function main() {
  console.log("=== Teste de Criação de Pool com SDK Aegis ===\n");

  // Configuração
  const RPC = process.env.AEGIS_RPC_ENDPOINT || "https://api.devnet.solana.com";
  const connection = new Connection(RPC, "confirmed");
  
  console.log(`🔗 RPC: ${RPC}\n`);

  // Carregar ou criar keypair
  let payer: Keypair;
  const secretsDir = path.resolve(__dirname, "../../.secrets/devnet");
  const payerPath = path.join(secretsDir, "vault-owner.json");

  if (fs.existsSync(payerPath)) {
    console.log("📂 Carregando keypair existente...");
    const secret = JSON.parse(fs.readFileSync(payerPath, "utf8"));
    payer = Keypair.fromSecretKey(new Uint8Array(secret));
  } else {
    console.log("🔑 Criando novo keypair...");
    payer = Keypair.generate();
    
    // Salvar keypair
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true });
    }
    fs.writeFileSync(
      payerPath,
      JSON.stringify(Array.from(payer.secretKey))
    );
    
    console.log("⚠️  ATENÇÃO: Financie esta carteira com SOL devnet:");
    console.log(`   solana airdrop 2 ${payer.publicKey.toString()} --url devnet\n`);
    
    // Solicitar airdrop automaticamente
    try {
      console.log("🪂 Solicitando airdrop...");
      const airdropSig = await connection.requestAirdrop(
        payer.publicKey,
        2 * 1e9 // 2 SOL
      );
      await connection.confirmTransaction(airdropSig);
      console.log("✅ Airdrop confirmado!\n");
    } catch (error) {
      console.error("❌ Erro no airdrop:", error);
      console.log("Execute manualmente: solana airdrop 2 " + payer.publicKey.toString() + " --url devnet\n");
      process.exit(1);
    }
  }

  console.log(`👛 Payer: ${payer.publicKey.toString()}`);

  // Verificar saldo
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL\n`);

  if (balance < 0.1 * 1e9) {
    console.error("❌ Saldo insuficiente! Necessário pelo menos 0.1 SOL");
    console.log(`Execute: solana airdrop 2 ${payer.publicKey.toString()} --url devnet`);
    process.exit(1);
  }

  // Inicializar SDK Aegis
  const wallet = new SimpleWallet(payer);
  const aegis = new Aegis(connection, wallet as any);

  console.log(`📋 Program ID: ${aegis.programId.toString()}\n`);

  // Criar tokens de teste
  console.log("=== Criando Tokens de Teste ===\n");

  const mintA = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    6
  );
  console.log(`✅ Token A: ${mintA.toString()}`);

  const mintB = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    6
  );
  console.log(`✅ Token B: ${mintB.toString()}\n`);

  // Mintar tokens para o payer
  console.log("=== Mintando Tokens ===\n");

  const userTokenA = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintA,
    payer.publicKey
  );
  await mintTo(
    connection,
    payer,
    mintA,
    userTokenA.address,
    payer,
    1_000_000_000_000 // 1M tokens
  );
  console.log(`✅ Mintado 1,000,000 Token A`);

  const userTokenB = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintB,
    payer.publicKey
  );
  await mintTo(
    connection,
    payer,
    mintB,
    userTokenB.address,
    payer,
    1_000_000_000_000
  );
  console.log(`✅ Mintado 1,000,000 Token B\n`);

  // Testar criação de pool com SDK
  console.log("=== Criando Pool com SDK Aegis ===\n");

  try {
    // Ordenar mints (A < B)
    const [sortedMintA, sortedMintB] = mintA.toBuffer().compare(mintB.toBuffer()) < 0
      ? [mintA, mintB]
      : [mintB, mintA];

    console.log("📝 Parâmetros da pool:");
    console.log(`  Mint A: ${sortedMintA.toString()}`);
    console.log(`  Mint B: ${sortedMintB.toString()}`);
    console.log(`  Fee: 30 bps (0.3%)`);
    console.log(`  Payer: ${payer.publicKey.toString()}\n`);

    console.log("🚀 Chamando Pool.create()...\n");

    const pool = await Pool.create(
      aegis,
      sortedMintA,
      sortedMintB,
      30, // 0.3% fee
      payer
    );

    console.log("✅ Pool criada com sucesso!");
    console.log(`  Pool Address: ${pool.info.address.toString()}`);
    console.log(`  Vault A: ${pool.info.vaultA.toString()}`);
    console.log(`  Vault B: ${pool.info.vaultB.toString()}`);
    console.log(`  LP Mint: ${pool.info.lpMint.toString()}\n`);

    // Adicionar liquidez
    console.log("=== Adicionando Liquidez ===\n");

    // Obter as contas corretas baseado na ordenação
    let tokenAAccount = userTokenA.address;
    let tokenBAccount = userTokenB.address;

    if (!sortedMintA.equals(mintA)) {
      // Se inverteu, inverter as contas também
      tokenAAccount = userTokenB.address;
      tokenBAccount = userTokenA.address;
    }

    const userLpToken = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      pool.info.lpMint,
      payer.publicKey
    );

    const amountA = new BN(100_000_000_000); // 100k tokens
    const amountB = new BN(100_000_000_000); // 100k tokens

    console.log(`  Amount A: ${amountA.toString()}`);
    console.log(`  Amount B: ${amountB.toString()}`);
    console.log(`  User Token A: ${tokenAAccount.toString()}`);
    console.log(`  User Token B: ${tokenBAccount.toString()}`);
    console.log(`  User LP Token: ${userLpToken.address.toString()}\n`);

    await pool.addLiquidity(
      { amountA, amountB },
      tokenAAccount,
      tokenBAccount,
      userLpToken.address
    );

    console.log("✅ Liquidez adicionada com sucesso!\n");

    // Verificar estado da pool
    console.log("=== Verificando Estado da Pool ===\n");

    const vaultAAccount = await getAccount(connection, pool.info.vaultA);
    const vaultBAccount = await getAccount(connection, pool.info.vaultB);
    const lpBalance = await getAccount(connection, userLpToken.address);

    console.log(`💰 Vault A balance: ${vaultAAccount.amount}`);
    console.log(`💰 Vault B balance: ${vaultBAccount.amount}`);
    console.log(`🎫 LP tokens recebidos: ${lpBalance.amount}\n`);

    // Listar todas as pools
    console.log("=== Listando Todas as Pools ===\n");

    const allPools = await aegis.getPools();
    console.log(`📊 Total de pools: ${allPools.length}\n`);

    for (const p of allPools) {
      console.log(`Pool: ${p.info.address.toString()}`);
      console.log(`  Mint A: ${p.info.mintA.toString()}`);
      console.log(`  Mint B: ${p.info.mintB.toString()}`);
      console.log(`  Fee: ${p.info.feeBps} bps`);
      console.log(`  LP Supply: ${p.info.lpSupply.toString()}`);
      console.log(`  Creator: ${p.info.creator.toString()}\n`);
    }

    console.log("✅ Teste concluído com sucesso!");
    console.log("\n📝 Informações para usar no frontend:");
    console.log(`  Token A: ${sortedMintA.toString()}`);
    console.log(`  Token B: ${sortedMintB.toString()}`);
    console.log(`  Pool: ${pool.info.address.toString()}`);

  } catch (error: any) {
    console.error("\n❌ Erro ao criar pool:");
    console.error(error);
    
    if (error.logs) {
      console.error("\n📋 Program Logs:");
      error.logs.forEach((log: string) => console.error(`   ${log}`));
    }

    if (error.message) {
      console.error(`\n💬 Mensagem: ${error.message}`);
    }

    // Análise de erros comuns
    console.error("\n🔍 Possíveis causas:");
    
    if (error.message?.includes("insufficient")) {
      console.error("  - Saldo insuficiente de SOL ou tokens");
    }
    
    if (error.message?.includes("already in use")) {
      console.error("  - Pool já existe para esse par de tokens");
      console.error("  - Tente usar tokens diferentes ou verificar pools existentes");
    }
    
    if (error.message?.includes("MintOrderInvalid")) {
      console.error("  - Ordem dos mints está incorreta (deve ser A < B)");
    }
    
    if (error.message?.includes("InvalidFee")) {
      console.error("  - Fee está fora do range válido");
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:");
  console.error(err);
  process.exit(1);
});
