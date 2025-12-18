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
    if (!programId || !connection) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all pool accounts from the program
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: POOL_DATA_SIZE },
        ],
        commitment: 'confirmed',
      });

      const poolInfos: PoolInfo[] = [];

      for (const account of accounts) {
        try {
          const data = account.account.data;

          // Check discriminator
          const discriminator = data.slice(0, 8);
          if (!discriminator.equals(POOL_DISCRIMINATOR)) {
            console.warn('Skipping account with invalid discriminator:', account.pubkey.toString());
            continue;
          }

          // Parse pool data according to the program structure
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
        } catch (err) {
          console.warn('Failed to parse pool account:', account.pubkey.toString(), err);
        }
      }

      setPools(poolInfos);
      setLastUpdate(new Date());
      
      if (poolInfos.length === 0) {
        console.warn('No pools found on-chain. Make sure pools are initialized.');
      }
    } catch (err: any) {
      console.error('Failed to fetch pools:', err);
      setError(err.message || 'Failed to fetch pools');
      
      // Fallback to empty array on error
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, [programId, connection]);

  useEffect(() => {
    fetchPools();

    // Set up auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchPools();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchPools]);

  useEffect(() => {
    fetchPools();
  }, [programId, connection]);

  // Buscar decimais dos tokens conhecidos
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
          // Usar decimais padrão se falhar
          decimalsMap.set(token.mint.toString(), token.decimals);
        }
      }
      
      setTokenDecimals(decimalsMap);
    };

    fetchDecimals();
  }, [connection]);

  const getAvailableTokens = (): TokenInfo[] => {
    const tokenMap = new Map<string, TokenInfo>();

    // Primeiro, adicionar tokens conhecidos (SOL + tokens mintados)
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

    // Depois, adicionar tokens dos pools (pode sobrescrever se já existir)
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
        // Atualizar decimais se já existe
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
        // Atualizar decimais se já existe
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

// Lista de tokens conhecidos (SOL + tokens mintados do Aegis Protocol)
function getKnownTokens(): TokenInfo[] {
  return [
    {
      mint: new PublicKey('So1111111111111111111111111111111112'), // Wrapped SOL (devnet/mainnet)
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
    },
    {
      mint: new PublicKey('GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9'), // AEGIS
      symbol: 'AEGIS',
      name: 'Aegis Token',
      decimals: 6,
    },
    {
      mint: new PublicKey('DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3'), // AERO
      symbol: 'AERO',
      name: 'Aero Token',
      decimals: 6,
    },
    {
      mint: new PublicKey('3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc'), // ABTC
      symbol: 'ABTC',
      name: 'Aegis Bitcoin',
      decimals: 6,
    },
    {
      mint: new PublicKey('D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys'), // AUSD
      symbol: 'AUSD',
      name: 'Aegis USD',
      decimals: 6,
    },
    {
      mint: new PublicKey('7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15'), // ASOL
      symbol: 'ASOL',
      name: 'Aegis SOL',
      decimals: 6,
    },
  ];
}

// Funções auxiliares para identificar tokens comuns
function getTokenSymbol(mint: PublicKey): string {
  const mintStr = mint.toString();

  // Tokens do Aegis Protocol na devnet
  const tokenMap: Record<string, string> = {
    'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9': 'AEGIS',
    'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3': 'AERO',
    '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc': 'ABTC',
    'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys': 'AUSD',
    '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15': 'ASOL',
    // Tokens comuns na devnet
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
    // Tokens comuns na devnet
    'So1111111111111111111111111111111112': 'Solana',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USD Coin',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'Tether USD',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'Ethereum',
    '2FPyCwUReMandcnypmxvT6DvdDB8NXW19TGa1Y1EAhZg': 'Bitcoin',
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfWB782': 'Marinade SOL',
  };

  return tokenMap[mintStr] || `Token ${mintStr.slice(0, 8)}`;
}