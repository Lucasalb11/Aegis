import { useEffect, useState } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { AegisClient } from '@aegis/sdk';

export interface PoolInfo {
  publicKey: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  vaultA: PublicKey;
  vaultB: PublicKey;
  lpMint: PublicKey;
  feeBps: number;
  lpSupply: number;
  creator: PublicKey;
}

export interface TokenInfo {
  mint: PublicKey;
  symbol: string;
  name: string;
  decimals: number;
}

export function usePools(programId?: PublicKey) {
  const { connection } = useConnection();
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPools = async () => {
    if (!programId || !connection) return;

    setLoading(true);
    setError(null);

    try {
      // Buscar todas as contas de pool
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            dataSize: 8 + 32 + 32 + 32 + 32 + 32 + 2 + 8 + 32 + 1 + 1 + 1 + 1 + 5, // Pool::SIZE
          },
        ],
      });

      const poolInfos: PoolInfo[] = [];

      for (const account of accounts) {
        try {
          // Parse pool account data
          const data = account.account.data;
          const pool: PoolInfo = {
            publicKey: account.pubkey,
            mintA: new PublicKey(data.slice(8, 40)),
            mintB: new PublicKey(data.slice(40, 72)),
            vaultA: new PublicKey(data.slice(72, 104)),
            vaultB: new PublicKey(data.slice(104, 136)),
            lpMint: new PublicKey(data.slice(136, 168)),
            feeBps: data.readUInt16LE(168),
            lpSupply: Number(data.readBigUInt64LE(170)),
            creator: new PublicKey(data.slice(178, 210)),
          };

          // Verificar se tem liquidez
          const vaultABalance = await connection.getTokenAccountBalance(pool.vaultA);
          const vaultBBalance = await connection.getTokenAccountBalance(pool.vaultB);

          if (vaultABalance.value.uiAmount && vaultBBalance.value.uiAmount) {
            poolInfos.push(pool);
          }
        } catch (err) {
          console.warn('Failed to parse pool account:', account.pubkey.toString(), err);
        }
      }

      setPools(poolInfos);
    } catch (err: any) {
      console.error('Failed to fetch pools:', err);
      setError(err.message || 'Failed to fetch pools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPools();
  }, [programId, connection]);

  const getAvailableTokens = (): TokenInfo[] => {
    const tokenMap = new Map<string, TokenInfo>();

    pools.forEach(pool => {
      // Token A
      const mintAKey = pool.mintA.toString();
      if (!tokenMap.has(mintAKey)) {
        tokenMap.set(mintAKey, {
          mint: pool.mintA,
          symbol: getTokenSymbol(pool.mintA),
          name: getTokenName(pool.mintA),
          decimals: 6, // Default, será atualizado depois
        });
      }

      // Token B
      const mintBKey = pool.mintB.toString();
      if (!tokenMap.has(mintBKey)) {
        tokenMap.set(mintBKey, {
          mint: pool.mintB,
          symbol: getTokenSymbol(pool.mintB),
          name: getTokenName(pool.mintB),
          decimals: 6, // Default, será atualizado depois
        });
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

  const refreshPools = () => {
    fetchPools();
  };

  return {
    pools,
    loading,
    error,
    availableTokens: getAvailableTokens(),
    getPoolForTokens,
    refreshPools,
  };
}

// Funções auxiliares para identificar tokens comuns
function getTokenSymbol(mint: PublicKey): string {
  const mintStr = mint.toString();

  // Tokens comuns na devnet
  const tokenMap: Record<string, string> = {
    'So11111111111111111111111111111112': 'SOL',
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
    'So11111111111111111111111111111112': 'Solana',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USD Coin',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'Tether USD',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'Ethereum',
    '2FPyCwUReMandcnypmxvT6DvdDB8NXW19TGa1Y1EAhZg': 'Bitcoin',
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfWB782': 'Marinade SOL',
  };

  return tokenMap[mintStr] || `Token ${mintStr.slice(0, 8)}`;
}