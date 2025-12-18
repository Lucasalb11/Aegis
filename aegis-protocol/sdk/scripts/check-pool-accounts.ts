import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const programId = new PublicKey('AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu');

const baseTokenMint = new PublicKey('GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9');
const otherMints = [
  new PublicKey('DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3'), // AERO
  new PublicKey('3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc'), // ABTC
  new PublicKey('D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys'), // AUSD
  new PublicKey('7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15'), // ASOL
];

function sortMints(a: PublicKey, b: PublicKey): [PublicKey, PublicKey] {
  return a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
}

async function main() {
  console.log('Checking pool accounts...\n');
  
  for (const mint of otherMints) {
    const [mintA, mintB] = sortMints(baseTokenMint, mint);
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), mintA.toBuffer(), mintB.toBuffer()],
      programId
    );
    
    const accountInfo = await connection.getAccountInfo(poolPda);
    console.log(`Pool ${mint.toString().substring(0, 8)}...: ${accountInfo ? 'EXISTS (' + accountInfo.data.length + ' bytes)' : 'DOES NOT EXIST'}`);
  }
}

main().catch(console.error);
