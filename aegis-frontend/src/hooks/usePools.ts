import { useEffect, useState, useCallback } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { AegisClient } from '@aegis/sdk';
import { getMint } from '@solana/spl-token';
import BN from 'bn.js';

export interface PoolInfo {
  publicKey: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  vaultA: PublicKey;
  vaultB: PublicKey;
  lpMint: PublicKey;
  feeBps: number;
  lpSupply: BN;
  creator: PublicKey;
}

export interface TokenInfo {
  mint: PublicKey;
  symbol: string;
  name: string;
  decimals: number;
}

// Pool discriminator for Aegis Protocol
const POOL_DISCRIMINATOR = Buffer.from([241, 154, 109, 4, 17, 177, 109, 188]);
const POOL_DATA_SIZE = 219;

export function usePools(programId?: PublicKey) {
  const { connection } = useConnection();
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [tokenDecimals, setTokenDecimals] = useState<Map<string, number>>(new Map());

  const fetchPools = useCallback(async () => {
    if (!programId || !connection) {
      setPools([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[usePools] Fetching pools for program: ${programId.toString()}`);
      
      // Fetch all pool accounts from the program
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: POOL_DATA_SIZE },
        ],
        commitment: 'confirmed',
      });

      console.log(`[usePools] Found ${accounts.length} accounts with size ${POOL_DATA_SIZE}`);

      const poolInfos: PoolInfo[] = [];
      let validPools = 0;
      let invalidDiscriminator = 0;
      let parseErrors = 0;

      for (const account of accounts) {
        try {
          const data = account.account.data;

          // Validate data length
          if (data.length < POOL_DATA_SIZE) {
            console.warn(`[usePools] Account ${account.pubkey.toString()} has insufficient data: ${data.length} < ${POOL_DATA_SIZE}`);
            continue;
          }

          // Check discriminator
          const discriminator = data.slice(0, 8);
          if (!discriminator.equals(POOL_DISCRIMINATOR)) {
            invalidDiscriminator++;
            console.warn(`[usePools] Invalid discriminator for ${account.pubkey.toString()}. Expected:`, Array.from(POOL_DISCRIMINATOR), 'Got:', Array.from(discriminator));
            continue;
          }

          // Parse pool data according to the program structure (based on IDL)
          // Offset 0-7: discriminator (already checked)
          // Offset 8-39: mintA (32 bytes)
          // Offset 40-71: mintB (32 bytes)
          // Offset 72-103: vaultA (32 bytes)
          // Offset 104-135: vaultB (32 bytes)
          // Offset 136-167: lpMint (32 bytes)
          // Offset 168-169: feeBps (u16, little-endian)
          // Offset 170-177: lpSupply (u64, little-endian)
          // Offset 178-209: creator (32 bytes)
          
          const mintA = new PublicKey(data.slice(8, 40));
          const mintB = new PublicKey(data.slice(40, 72));
          const vaultA = new PublicKey(data.slice(72, 104));
          const vaultB = new PublicKey(data.slice(104, 136));
          const lpMint = new PublicKey(data.slice(136, 168));
          const feeBps = data.readUInt16LE(168);
          const lpSupply = new BN(data.readBigUInt64LE(170).toString());
          const creator = new PublicKey(data.slice(178, 210));

          poolInfos.push({
            publicKey: account.pubkey,
            mintA,
            mintB,
            vaultA,
            vaultB,
            lpMint,
            feeBps,
            lpSupply,
            creator,
          });
          validPools++;
        } catch (err: any) {
          parseErrors++;
          console.error(`[usePools] Failed to parse pool account ${account.pubkey.toString()}:`, err);
        }
      }

      console.log(`[usePools] Parsed ${validPools} valid pools (${invalidDiscriminator} invalid discriminators, ${parseErrors} parse errors)`);

      setPools(poolInfos);
      setLastUpdate(new Date());
      
      if (poolInfos.length === 0 && accounts.length > 0) {
        console.warn('[usePools] Accounts found but no valid pools parsed. Check discriminator and data structure.');
      } else if (poolInfos.length === 0) {
        console.info('[usePools] No pools found on-chain. Make sure pools are initialized.');
      }
    } catch (err: any) {
      console.error('[usePools] Failed to fetch pools:', err);
      setError(err.message || 'Failed to fetch pools');
      
      // Fallback to empty array on error
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, [programId, connection]);

  useEffect(() => {
    if (!programId || !connection) {
      setPools([]);
      return;
    }

    fetchPools();

    // Set up auto-refresh every 30 seconds (reduced frequency)
    const interval = setInterval(() => {
      fetchPools();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchPools, programId, connection]);

  // Fetch decimals for known tokens
  useEffect(() => {
    if (!connection) return;

    const knownTokens = getKnownTokens();
    const fetchDecimals = async () => {
      const decimalsMap = new Map<string, number>();
      
      for (const token of knownTokens) {
        try {
          const mintInfo = await getMint(connection, token.mint);
          decimalsMap.set(token.mint.toString(), mintInfo.decimals);
        } catch (err) {
          console.warn(`Failed to fetch decimals for ${token.mint.toString()}:`, err);
          // Use default decimals if fetch fails
          decimalsMap.set(token.mint.toString(), token.decimals);
        }
      }
      
      setTokenDecimals(decimalsMap);
    };

    fetchDecimals();
  }, [connection]);

  const getAvailableTokens = (): TokenInfo[] => {
    const tokenMap = new Map<string, TokenInfo>();

    // First, add known tokens (SOL + minted tokens)
    const knownTokens = getKnownTokens();
    knownTokens.forEach(token => {
      const mintKey = token.mint.toString();
      const decimals = tokenDecimals.get(mintKey) ?? token.decimals;
      tokenMap.set(mintKey, {
        mint: token.mint,
        symbol: token.symbol,
        name: token.name,
        decimals,
      });
    });

    // Then, add tokens from pools (may overwrite if already exists)
    pools.forEach(pool => {
      // Token A
      const mintAKey = pool.mintA.toString();
      if (!tokenMap.has(mintAKey)) {
        const decimals = tokenDecimals.get(mintAKey) ?? 6;
        tokenMap.set(mintAKey, {
          mint: pool.mintA,
          symbol: getTokenSymbol(pool.mintA),
          name: getTokenName(pool.mintA),
          decimals,
        });
      } else {
        // Update decimals if already exists
        const existing = tokenMap.get(mintAKey)!;
        const decimals = tokenDecimals.get(mintAKey) ?? existing.decimals;
        tokenMap.set(mintAKey, { ...existing, decimals });
      }

      // Token B
      const mintBKey = pool.mintB.toString();
      if (!tokenMap.has(mintBKey)) {
        const decimals = tokenDecimals.get(mintBKey) ?? 6;
        tokenMap.set(mintBKey, {
          mint: pool.mintB,
          symbol: getTokenSymbol(pool.mintB),
          name: getTokenName(pool.mintB),
          decimals,
        });
      } else {
        // Update decimals if already exists
        const existing = tokenMap.get(mintBKey)!;
        const decimals = tokenDecimals.get(mintBKey) ?? existing.decimals;
        tokenMap.set(mintBKey, { ...existing, decimals });
      }
    });

    return Array.from(tokenMap.values());
  };

  const getPoolForTokens = (fromMint: PublicKey, toMint: PublicKey): PoolInfo | null => {
    // Ordenar mints como no programa
    const [mintA, mintB] = fromMint.toBuffer().compare(toMint.toBuffer()) < 0
      ? [fromMint, toMint]
      : [toMint, fromMint];

    return pools.find(pool =>
      pool.mintA.equals(mintA) && pool.mintB.equals(mintB)
    ) || null;
  };

  const refreshPools = useCallback(() => {
    fetchPools();
  }, [fetchPools]);

  return {
    pools,
    loading,
    error,
    availableTokens: getAvailableTokens(),
    getPoolForTokens,
    refreshPools,
    lastUpdate,
  };
}

// Token addresses as strings to avoid SSR issues
const KNOWN_TOKEN_DATA = [
  { address: 'So1111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', decimals: 9 },
  { address: 'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9', symbol: 'AEGIS', name: 'Aegis Token', decimals: 6 },
  { address: 'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3', symbol: 'AERO', name: 'Aero Token', decimals: 6 },
  { address: '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc', symbol: 'ABTC', name: 'Aegis Bitcoin', decimals: 6 },
  { address: 'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys', symbol: 'AUSD', name: 'Aegis USD', decimals: 6 },
  { address: '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15', symbol: 'ASOL', name: 'Aegis SOL', decimals: 6 },
];

// Lista de tokens conhecidos (SOL + tokens mintados do Aegis Protocol)
// Cria PublicKeys de forma lazy para evitar problemas de SSR
function getKnownTokens(): TokenInfo[] {
  // Verificar se estamos no lado do cliente
  if (typeof window === 'undefined') {
    return [];
  }
  
  try {
    return KNOWN_TOKEN_DATA.map(token => ({
      mint: new PublicKey(token.address),
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
    }));
  } catch (error) {
    console.error('[usePools] Error creating known tokens:', error);
    return [];
  }
}

// Helper functions to identify common tokens
function getTokenSymbol(mint: PublicKey): string {
  const mintStr = mint.toString();

  // Aegis Protocol tokens on devnet
  const tokenMap: Record<string, string> = {
    'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9': 'AEGIS',
    'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3': 'AERO',
    '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc': 'ABTC',
    'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys': 'AUSD',
    '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15': 'ASOL',
    // Common tokens on devnet
    'So1111111111111111111111111111111112': 'SOL',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH',
    '2FPyCwUReMandcnypmxvT6DvdDB8NXW19TGa1Y1EAhZg': 'BTC',
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfWB782': 'mSOL',
  };

  return tokenMap[mintStr] || `${mintStr.slice(0, 4)}...${mintStr.slice(-4)}`;
}

function getTokenName(mint: PublicKey): string {
  const mintStr = mint.toString();

  const tokenMap: Record<string, string> = {
    'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9': 'Aegis Token',
    'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3': 'Aero Token',
    '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc': 'Aegis Bitcoin',
    'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys': 'Aegis USD',
    '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15': 'Aegis SOL',
    // Common tokens on devnet
    'So1111111111111111111111111111111112': 'Solana',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USD Coin',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'Tether USD',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'Ethereum',
    '2FPyCwUReMandcnypmxvT6DvdDB8NXW19TGa1Y1EAhZg': 'Bitcoin',
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfWB782': 'Marinade SOL',
  };

  return tokenMap[mintStr] || `Token ${mintStr.slice(0, 8)}`;
}