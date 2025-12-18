/**
 * Utilities for fetching and calculating real on-chain pool data
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import { PoolInfo } from '@/src/hooks/usePools';

// Token metadata cache
const TOKEN_METADATA: Record<string, { symbol: string; name: string; decimals: number; icon?: string }> = {
  'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9': {
    symbol: 'AEGIS',
    name: 'Aegis Token',
    decimals: 6,
    icon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOc2v63wG7G_vjriVQDPKbl7GcaOeGugQjhP8XT1sFfVW8IfMfB1yWMRRAXNRMOeUsJP_-31PoYUzTqUY0NuZrff-G8j-5vxc-pds83pc--J7NrJJcBWxVTDjl0Edg6ElQRDnApc4Sji6B-46nn_WFo_mdrZBq8lp1jzklSZT6AK20QIuDn4ojmefNJWVkAKP9B7Ib0GNUJRv5nS_gbCivNBtV4PnWpNeodiQkGenvtgnJGdf3xUBJyiyuw7vnWNJRhlk3KKzNvn1L',
  },
  'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3': {
    symbol: 'AERO',
    name: 'Aero Token',
    decimals: 6,
    icon: 'https://assets.coingecko.com/coins/images/17752/small/mSOL.png?1696516777',
  },
  '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc': {
    symbol: 'ABTC',
    name: 'Aegis Bitcoin',
    decimals: 6,
    icon: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg?1696528245',
  },
  'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys': {
    symbol: 'AUSD',
    name: 'Aegis USD',
    decimals: 6,
    icon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAykMhiUJhX_Q_0jS-jnKFU-knoD1oau_n2p2Ru_xQDpK1kPTWnYPZOKImrwQEAm_4aJeuLM4wsaI7X2nxCoTAWtoBY_gTKvOSe07nl4KEuCPr6kRml2G9wNhtMdA4FfidRYKxWy99Vh0nMeI59vq6EmIiI8R2iSU-GhRt1cVySx0xdNpfoVNXsY9AbODho7szpV1CIxYIdL0mSqQn-nX1JtMhpLei1TOloY7gMDHjmbmWapt9WsQXT1Z4gYIt4PX7C_B1rdxSaB70',
  },
  '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15': {
    symbol: 'ASOL',
    name: 'Aegis SOL',
    decimals: 6,
    icon: 'https://assets.coingecko.com/coins/images/17752/small/mSOL.png?1696516777',
  },
  'So1111111111111111111111111111111112': {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
};

// Price cache (in production, fetch from oracles)
const PRICE_CACHE: Record<string, number> = {
  'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9': 5.0, // AEGIS
  'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3': 5.0, // AERO
  '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc': 30000.0, // ABTC
  'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys': 1.0, // AUSD
  '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15': 100.0, // ASOL
  'So1111111111111111111111111111111112': 100.0, // SOL
};

export interface PoolMetrics {
  tvlUsd: number;
  volume24hUsd: number;
  fees24hUsd: number;
  apr: number;
  tokenA: {
    symbol: string;
    amount: number;
    usd: number;
    icon?: string;
  };
  tokenB: {
    symbol: string;
    amount: number;
    usd: number;
    icon?: string;
  };
}

/**
 * Get token metadata (symbol, name, decimals, icon)
 */
export async function getTokenMetadata(
  connection: Connection,
  mint: PublicKey
): Promise<{ symbol: string; name: string; decimals: number; icon?: string }> {
  const mintStr = mint.toString();
  
  // Check cache first
  if (TOKEN_METADATA[mintStr]) {
    return TOKEN_METADATA[mintStr];
  }

  // Try to fetch from on-chain metadata (if available)
  try {
    const mintInfo = await getMint(connection, mint);
    return {
      symbol: `${mintStr.slice(0, 4)}...${mintStr.slice(-4)}`,
      name: `Token ${mintStr.slice(0, 8)}`,
      decimals: mintInfo.decimals,
    };
  } catch {
    return {
      symbol: `${mintStr.slice(0, 4)}...${mintStr.slice(-4)}`,
      name: `Token ${mintStr.slice(0, 8)}`,
      decimals: 6, // Default
    };
  }
}

/**
 * Get token price in USD (from cache or oracle)
 */
export function getTokenPrice(mint: PublicKey): number {
  const mintStr = mint.toString();
  return PRICE_CACHE[mintStr] || 1.0; // Default to $1 if unknown
}

/**
 * Calculate pool TVL from vault balances
 */
export async function calculatePoolTVL(
  connection: Connection,
  poolInfo: PoolInfo
): Promise<PoolMetrics> {
  try {
    // Get vault balances
    const [vaultA, vaultB] = await Promise.all([
      getAccount(connection, poolInfo.vaultA).catch(() => null),
      getAccount(connection, poolInfo.vaultB).catch(() => null),
    ]);

    // Get token metadata
    const [tokenAInfo, tokenBInfo] = await Promise.all([
      getTokenMetadata(connection, poolInfo.mintA),
      getTokenMetadata(connection, poolInfo.mintB),
    ]);

    // Get token decimals
    const [mintAInfo, mintBInfo] = await Promise.all([
      getMint(connection, poolInfo.mintA).catch(() => ({ decimals: tokenAInfo.decimals })),
      getMint(connection, poolInfo.mintB).catch(() => ({ decimals: tokenBInfo.decimals })),
    ]);

    // Calculate amounts
    const amountA = vaultA
      ? Number(vaultA.amount) / Math.pow(10, mintAInfo.decimals)
      : 0;
    const amountB = vaultB
      ? Number(vaultB.amount) / Math.pow(10, mintBInfo.decimals)
      : 0;

    // Get prices
    const priceA = getTokenPrice(poolInfo.mintA);
    const priceB = getTokenPrice(poolInfo.mintB);

    // Calculate USD values
    const usdA = amountA * priceA;
    const usdB = amountB * priceB;
    const tvlUsd = usdA + usdB;

    // Calculate fees (estimate based on feeBps)
    // In production, track actual swap volume from transaction history
    const estimatedVolume24h = tvlUsd * 0.1; // Estimate 10% of TVL as daily volume
    const fees24hUsd = (estimatedVolume24h * poolInfo.feeBps) / 10000;

    // Calculate APR (simplified: fees / TVL * 365)
    const apr = tvlUsd > 0 ? (fees24hUsd / tvlUsd) * 365 * 100 : 0;

    return {
      tvlUsd,
      volume24hUsd: estimatedVolume24h,
      fees24hUsd,
      apr,
      tokenA: {
        symbol: tokenAInfo.symbol,
        amount: amountA,
        usd: usdA,
        icon: tokenAInfo.icon,
      },
      tokenB: {
        symbol: tokenBInfo.symbol,
        amount: amountB,
        usd: usdB,
        icon: tokenBInfo.icon,
      },
    };
  } catch (error) {
    console.error('Error calculating pool TVL:', error);
    // Return default values
    return {
      tvlUsd: 0,
      volume24hUsd: 0,
      fees24hUsd: 0,
      apr: 0,
      tokenA: {
        symbol: 'TOKEN A',
        amount: 0,
        usd: 0,
      },
      tokenB: {
        symbol: 'TOKEN B',
        amount: 0,
        usd: 0,
      },
    };
  }
}

/**
 * Generate pool slug from token symbols
 */
export function generatePoolSlug(mintA: PublicKey, mintB: PublicKey): string {
  const symbolA = TOKEN_METADATA[mintA.toString()]?.symbol || mintA.toString().slice(0, 4);
  const symbolB = TOKEN_METADATA[mintB.toString()]?.symbol || mintB.toString().slice(0, 4);
  return `${symbolA.toLowerCase()}-${symbolB.toLowerCase()}`;
}

/**
 * Generate pool name from token symbols
 */
export function generatePoolName(mintA: PublicKey, mintB: PublicKey): string {
  const symbolA = TOKEN_METADATA[mintA.toString()]?.symbol || mintA.toString().slice(0, 4);
  const symbolB = TOKEN_METADATA[mintB.toString()]?.symbol || mintB.toString().slice(0, 4);
  return `${symbolA}-${symbolB} Pool`;
}
