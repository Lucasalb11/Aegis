/**
 * Script de teste para criar pools diretamente on-chain
 * 
 * Este script cria pools de teste para diagnosticar problemas
 * na criação de pools pelo frontend.
 */

import fs from "fs";
import path from "path";
import { AnchorProvider, BN, BorshCoder, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import idl from "../src/idl.json";

// Implementação do Wallet compatível com Anchor
class KeypairWallet implements Wallet {
  constructor(readonly payer: Keypair) {}
  
  get publicKey() {
    return this.payer.publicKey;
  }
  
  async signTransaction(tx: Transaction) {
    tx.sign(this.payer);
    return tx;
  }
  
  async signAllTransactions(txs: Transaction[]) {
    return txs.map((tx) => {
      tx.sign(this.payer);
      return tx;
    });
  }
}

// Função para ordenar mints corretamente (A < B)
function sortMints(a: PublicKey, b: PublicKey): [PublicKey, PublicKey] {
  return a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
}

async function main() {
  console.log("=== Teste de Criação de Pools On-Chain ===\n");

  // Configuração da conexão
  const RPC = process.env.AEGIS_RPC_ENDPOINT || "https://api.devnet.solana.com";
  const connection = new Connection(RPC, "confirmed");
  const programId = new PublicKey(idl.address);

  console.log(`🔗 RPC: ${RPC}`);
  console.log(`📋 Program ID: ${programId.toString()}\n`);

  // Carregar ou criar keypair de teste
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
    console.log("⚠️  ATENÇÃO: Financie esta carteira com SOL devnet:");
    console.log(`   solana airdrop 2 ${payer.publicKey.toString()} --url devnet`);
    console.log("\nPressione ENTER depois de financiar...");
    // Aguardar input do usuário
    process.stdin.once("data", () => {});
  }

  console.log(`👛 Payer: ${payer.publicKey.toString()}`);

  // Verificar saldo
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL`);

  if (balance < 0.1 * 1e9) {
    console.error("\n❌ Saldo insuficiente! Necessário pelo menos 0.1 SOL");
    console.log(`Execute: solana airdrop 2 ${payer.publicKey.toString()} --url devnet`);
    process.exit(1);
  }

  // Configurar provider e program
  const wallet = new KeypairWallet(payer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const coder = new BorshCoder(idl as any);
  const slimIdl = { ...(idl as any), accounts: [] as any[] };
  const program = new Program(slimIdl as any, programId, provider, coder);

  console.log("\n=== Criando Tokens de Teste ===\n");

  // Criar tokens de teste
  const tokenA = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6, // decimals
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );
  console.log(`✅ Token A criado: ${tokenA.toString()}`);

  const tokenB = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6, // decimals
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );
  console.log(`✅ Token B criado: ${tokenB.toString()}`);

  const tokenC = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    9, // decimals diferentes para testar
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );
  console.log(`✅ Token C criado: ${tokenC.toString()}`);

  // Criar ATAs e mintar tokens
  console.log("\n=== Mintando Tokens de Teste ===\n");

  const userTokenA = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    tokenA,
    payer.publicKey
  );
  await mintTo(
    connection,
    payer,
    tokenA,
    userTokenA.address,
    payer,
    1_000_000_000_000 // 1 milhão de tokens
  );
  console.log(`✅ Mintado 1,000,000 Token A para ${userTokenA.address.toString()}`);

  const userTokenB = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    tokenB,
    payer.publicKey
  );
  await mintTo(
    connection,
    payer,
    tokenB,
    userTokenB.address,
    payer,
    1_000_000_000_000
  );
  console.log(`✅ Mintado 1,000,000 Token B para ${userTokenB.address.toString()}`);

  const userTokenC = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    tokenC,
    payer.publicKey
  );
  await mintTo(
    connection,
    payer,
    tokenC,
    userTokenC.address,
    payer,
    1_000_000_000_000_000 // 1 milhão com 9 decimais
  );
  console.log(`✅ Mintado 1,000,000 Token C para ${userTokenC.address.toString()}`);

  // Criar pools de teste
  console.log("\n=== Criando Pools de Teste ===\n");

  const poolsToCreate = [
    {
      name: "Pool A-B",
      mintA: tokenA,
      mintB: tokenB,
      feeBps: 30, // 0.3%
      amountA: 100_000_000_000, // 100k tokens
      amountB: 100_000_000_000, // 100k tokens
    },
    {
      name: "Pool A-C",
      mintA: tokenA,
      mintB: tokenC,
      feeBps: 25, // 0.25%
      amountA: 50_000_000_000, // 50k tokens
      amountB: 50_000_000_000_000, // 50k tokens (9 decimais)
    },
    {
      name: "Pool B-C",
      mintA: tokenB,
      mintB: tokenC,
      feeBps: 20, // 0.2%
      amountA: 200_000_000_000, // 200k tokens
      amountB: 200_000_000_000_000, // 200k tokens (9 decimais)
    },
  ];

  for (const poolConfig of poolsToCreate) {
    try {
      console.log(`\n🏊 Criando ${poolConfig.name}...`);
      
      // Ordenar mints corretamente
      const [mintA, mintB] = sortMints(poolConfig.mintA, poolConfig.mintB);
      console.log(`  Mint A (menor): ${mintA.toString()}`);
      console.log(`  Mint B (maior): ${mintB.toString()}`);

      // Derivar PDAs
      const [poolPda, poolBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
        programId
      );
      console.log(`  Pool PDA: ${poolPda.toString()}`);

      // Verificar se pool já existe
      const existingPool = await connection.getAccountInfo(poolPda);
      if (existingPool) {
        console.log(`  ⚠️  Pool já existe, pulando...`);
        continue;
      }

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

      console.log(`  Vault A: ${vaultA.toString()}`);
      console.log(`  Vault B: ${vaultB.toString()}`);
      console.log(`  LP Mint: ${lpMint.toString()}`);

      // 1. Inicializar pool
      console.log(`  📝 Inicializando pool (fee: ${poolConfig.feeBps} bps)...`);
      
      const initTx = await program.methods
        .initializePool(poolConfig.feeBps)
        .accounts({
          payer: payer.publicKey,
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
        .signers([payer])
        .rpc();

      console.log(`  ✅ Pool inicializado! TX: ${initTx}`);

      // Aguardar confirmação
      await connection.confirmTransaction(initTx, "confirmed");

      // 2. Adicionar liquidez inicial
      console.log(`  💧 Adicionando liquidez inicial...`);

      // Ajustar amounts baseado na ordenação
      let amountA = poolConfig.amountA;
      let amountB = poolConfig.amountB;
      let userA = userTokenA.address;
      let userB = userTokenB.address;

      if (mintA.equals(poolConfig.mintB)) {
        // Se mintA é o poolConfig.mintB, inverter
        [amountA, amountB] = [amountB, amountA];
      }

      // Determinar as contas corretas do usuário
      if (mintA.equals(tokenA)) {
        userA = userTokenA.address;
      } else if (mintA.equals(tokenB)) {
        userA = userTokenB.address;
      } else if (mintA.equals(tokenC)) {
        userA = userTokenC.address;
      }

      if (mintB.equals(tokenA)) {
        userB = userTokenA.address;
      } else if (mintB.equals(tokenB)) {
        userB = userTokenB.address;
      } else if (mintB.equals(tokenC)) {
        userB = userTokenC.address;
      }

      // Criar LP token account
      const userLpToken = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        lpMint,
        payer.publicKey
      );

      console.log(`  Amount A: ${amountA}`);
      console.log(`  Amount B: ${amountB}`);
      console.log(`  User Token A: ${userA.toString()}`);
      console.log(`  User Token B: ${userB.toString()}`);
      console.log(`  User LP Token: ${userLpToken.address.toString()}`);

      const liquidityTx = await program.methods
        .addLiquidity(new BN(amountA), new BN(amountB))
        .accounts({
          user: payer.publicKey,
          pool: poolPda,
          vaultA,
          vaultB,
          lpMint,
          userTokenA: userA,
          userTokenB: userB,
          userLpToken: userLpToken.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();

      console.log(`  ✅ Liquidez adicionada! TX: ${liquidityTx}`);
      
      await connection.confirmTransaction(liquidityTx, "confirmed");

      // Verificar estado final do pool
      const poolAccount = await connection.getAccountInfo(poolPda);
      if (poolAccount) {
        console.log(`  📊 Pool criado com sucesso!`);
        console.log(`     Tamanho da conta: ${poolAccount.data.length} bytes`);
      }

      // Verificar saldos dos vaults
      const vaultAAccount = await getAccount(connection, vaultA);
      const vaultBAccount = await getAccount(connection, vaultB);
      console.log(`  💰 Vault A balance: ${vaultAAccount.amount}`);
      console.log(`  💰 Vault B balance: ${vaultBAccount.amount}`);

      // Verificar LP tokens
      const lpBalance = await getAccount(connection, userLpToken.address);
      console.log(`  🎫 LP tokens recebidos: ${lpBalance.amount}`);

    } catch (error: any) {
      console.error(`\n❌ Erro ao criar ${poolConfig.name}:`);
      console.error(error);
      
      // Log detalhado do erro
      if (error.logs) {
        console.error("\n📋 Program Logs:");
        error.logs.forEach((log: string) => console.error(`   ${log}`));
      }
      
      if (error.message) {
        console.error(`\n💬 Mensagem: ${error.message}`);
      }
    }
  }

  // Listar todas as pools criadas
  console.log("\n=== Verificando Pools Criadas ===\n");

  try {
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        {
          dataSize: 219, // Pool::SIZE
        },
      ],
    });

    console.log(`📊 Total de pools encontradas: ${accounts.length}\n`);

    for (const account of accounts) {
      const data = account.account.data;
      
      // Parse pool data
      const mintA = new PublicKey(data.slice(8, 40));
      const mintB = new PublicKey(data.slice(40, 72));
      const vaultA = new PublicKey(data.slice(72, 104));
      const vaultB = new PublicKey(data.slice(104, 136));
      const lpMint = new PublicKey(data.slice(136, 168));
      const feeBps = data.readUInt16LE(168);
      const lpSupply = data.readBigUInt64LE(170);
      const creator = new PublicKey(data.slice(178, 210));

      console.log(`Pool: ${account.pubkey.toString()}`);
      console.log(`  Mint A: ${mintA.toString()}`);
      console.log(`  Mint B: ${mintB.toString()}`);
      console.log(`  Fee: ${feeBps} bps (${feeBps / 100}%)`);
      console.log(`  LP Supply: ${lpSupply}`);
      console.log(`  Creator: ${creator.toString()}`);
      
      // Verificar saldos dos vaults
      try {
        const vaultAAccount = await getAccount(connection, vaultA);
        const vaultBAccount = await getAccount(connection, vaultB);
        console.log(`  Vault A balance: ${vaultAAccount.amount}`);
        console.log(`  Vault B balance: ${vaultBAccount.amount}`);
      } catch (err) {
        console.log(`  ⚠️  Erro ao ler vaults`);
      }
      
      console.log("");
    }
  } catch (error) {
    console.error("❌ Erro ao listar pools:", error);
  }

  console.log("\n✅ Teste concluído!");
  console.log("\n📝 Resumo dos tokens criados para referência:");
  console.log(`   Token A: ${tokenA.toString()}`);
  console.log(`   Token B: ${tokenB.toString()}`);
  console.log(`   Token C: ${tokenC.toString()}`);
  console.log(`\n💡 Use esses endereços no frontend para testar!`);
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:");
  console.error(err);
  process.exit(1);
});
