import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function main() {
  const possiblePaths = [
    path.join(__dirname, '../../.secrets/devnet/treasury.json'),
    path.join(__dirname, '../../../.secrets/devnet/treasury.json'),
  ];
  
  let treasury: Keypair | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      treasury = loadKeypair(p);
      break;
    }
  }
  
  if (!treasury) {
    console.error('Treasury not found!');
    process.exit(1);
  }
  
  const to = new PublicKey('EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z');
  const amount = 6 * LAMPORTS_PER_SOL;
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: to,
      lamports: amount,
    })
  );
  
  const signature = await connection.sendTransaction(tx, [treasury]);
  await connection.confirmTransaction(signature);
  
  console.log(`✅ Transferred 6 SOL to upgrade authority`);
  console.log(`Signature: ${signature}`);
}

main().catch(console.error);
