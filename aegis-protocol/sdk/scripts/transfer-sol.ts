import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function main() {
  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../../.secrets/devnet/treasury.json'),
    path.join(__dirname, '../../../.secrets/devnet/treasury.json'),
    path.join(__dirname, '../../program/.secrets/devnet/treasury.json'),
  ];
  
  let treasury: Keypair | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      treasury = loadKeypair(p);
      console.log(`Found treasury at: ${p}`);
      break;
    }
  }
  
  if (!treasury) {
    console.error('Treasury keypair not found!');
    process.exit(1);
  }
  
  const to = new PublicKey('EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z');
  const amount = 5 * LAMPORTS_PER_SOL;
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  console.log(`From: ${treasury.publicKey.toString()}`);
  console.log(`To: ${to.toString()}`);
  console.log(`Amount: 5 SOL`);
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: to,
      lamports: amount,
    })
  );
  
  const signature = await connection.sendTransaction(tx, [treasury]);
  await connection.confirmTransaction(signature);
  
  console.log(`✅ Transferred 5 SOL`);
  console.log(`Signature: ${signature}`);
}

main().catch(console.error);
