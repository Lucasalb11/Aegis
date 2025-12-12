import { PublicKey } from '@solana/web3.js';

export function findPoolAddress(
  programId: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey
): [PublicKey, number] {
  // Ensure mintA < mintB for consistent ordering
  const [token0, token1] = mintA.toBuffer().compare(mintB.toBuffer()) < 0
    ? [mintA, mintB]
    : [mintB, mintA];

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('pool'),
      token0.toBuffer(),
      token1.toBuffer(),
    ],
    programId
  );
}

export function findPoolVaultAddress(
  programId: PublicKey,
  pool: PublicKey,
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('pool_vault'),
      pool.toBuffer(),
      mint.toBuffer(),
    ],
    programId
  );
}

export function findLpMintAddress(
  programId: PublicKey,
  pool: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('lp_mint'),
      pool.toBuffer(),
    ],
    programId
  );
}

export function calculateSlippage(amount: number, slippageBps: number): number {
  return Math.floor(amount * (10000 - slippageBps) / 10000);
}

export function calculateFee(amount: number, feeBps: number): number {
  return Math.floor(amount * feeBps / 10000);
}


