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
      // Return mock pools with correct PDAs and token addresses
      const mockPoolInfos: PoolInfo[] = [
        {
          publicKey: new PublicKey("E7haxmME6WR1Eu77dvyftMcDE9Dc81MbmF5RNU8NGdtt"), // AEGIS-AUSD pool PDA
          mintA: new PublicKey("GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9"), // AEGIS
          mintB: new PublicKey("D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys"), // AUSD
          vaultA: new PublicKey("J7FKr1XdX7oPFZ57A4YJCdb4e1k7MpJgvktSEQWMeSmZ"),
          vaultB: new PublicKey("HprTYoBPJsQtq2yCNZWEYMUkjVvALdoKbhHZZ1j8NZVr"),
          lpMint: new PublicKey("CT9ATmXV3jVPVocdZZfGkEsmsBCMSnghgWKwPeueVXg9"),
          feeBps: 30,
          lpSupply: 1000000,
          creator: new PublicKey("EQ5c3ZTo33GFpB2JjCqga3ecnbv9cbRpGqnSYu4Dmyof"),
        },
        {
          publicKey: new PublicKey("GE2eXgFpPW5p9FZkqdjyrcxJd5sGBxCiEM6LHUFEutyJ"), // AERO-AUSD pool PDA
          mintA: new PublicKey("DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3"), // AERO
          mintB: new PublicKey("D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys"), // AUSD
          vaultA: new PublicKey("GpgSbSyaUqt5cPLuxQcV4UKrn5pGxuyfcX4MCP2knUbc"),
          vaultB: new PublicKey("2jDkhqLxGXza6uiDowzxM88bN8vi34bhYXjd1om91out"),
          lpMint: new PublicKey("8Z1jSFfrwgcmhpzbqTkCEtBa2AVtabVXU1hEn93FaJJa"),
          feeBps: 20,
          lpSupply: 1000000,
          creator: new PublicKey("EQ5c3ZTo33GFpB2JjCqga3ecnbv9cbRpGqnSYu4Dmyof"),
        },
        {
          publicKey: new PublicKey("D6w1vufUGfs2YAZ9xRGrMmEZuhyKp5eedpCc1sUFXbr4"), // ABTC-AUSD pool PDA
          mintA: new PublicKey("3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc"), // ABTC
          mintB: new PublicKey("D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys"), // AUSD
          vaultA: new PublicKey("J95rEurcVaid9qzWhy8yJDcMfmTm4HQDCxRFAu9idV2P"),
          vaultB: new PublicKey("FKnfQbW379vJ6PR7k7BMfpfDnTHV5Gj8En2KhcvJ5qgi"),
          lpMint: new PublicKey("G9veKwAPyS6GwrXASbMFkPnkXGfmECbuj3cSWmRR8jLf"),
          feeBps: 25,
          lpSupply: 1000000,
          creator: new PublicKey("EQ5c3ZTo33GFpB2JjCqga3ecnbv9cbRpGqnSYu4Dmyof"),
        },
        {
          publicKey: new PublicKey("FcwzNJ5GQjZPQ9vZXq1rTMx8Z48RaPHbgZ2oPn3a8hyZ"), // AEGIS-ASOL pool PDA
          mintA: new PublicKey("GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9"), // AEGIS
          mintB: new PublicKey("7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15"), // ASOL
          vaultA: new PublicKey("6D1nvhDJiswAFNGGtkahyDLmCQEqBiPYvGbZ65asz7zi"),
          vaultB: new PublicKey("BfA2EHvggDyxVnSkZHjwdUsmQeo4yTL4TpEQt1tTjtvY"),
          lpMint: new PublicKey("CCn6T5btgHMsoCkYUvE7emAjq6Qk4Urve1vVLEghXkZt"),
          feeBps: 35,
          lpSupply: 1000000,
          creator: new PublicKey("EQ5c3ZTo33GFpB2JjCqga3ecnbv9cbRpGqnSYu4Dmyof"),
        },
        {
          publicKey: new PublicKey("ABtWdKx71ghcrJPHdJYdmVu49pU4DFUMM5GVvfUudH1E"), // ABTC-ASOL pool PDA
          mintA: new PublicKey("3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc"), // ABTC
          mintB: new PublicKey("7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15"), // ASOL
          vaultA: new PublicKey("74SVR51pVG88B2FjecodKSBASpt3UnC5x5oqEF4Sk4gP"),
          vaultB: new PublicKey("H4Hzn5dbbgP7AvXEsn7kebTuHmyAGSP1FegWpmWBtBQB"),
          lpMint: new PublicKey("5UnK54hfqXL8LsnExcqCgQDHE3x2xY3BLTNVBbSMd5Q9"),
          feeBps: 40,
          lpSupply: 1000000,
          creator: new PublicKey("EQ5c3ZTo33GFpB2JjCqga3ecnbv9cbRpGqnSYu4Dmyof"),
        },
      ];

      setPools(mockPoolInfos);

      // Uncomment when real pools are deployed:
      /*
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [{ dataSize: 219 }],
      });

      const poolInfos: PoolInfo[] = [];
      for (const account of accounts) {
        // Parse real pool data here
      }
      setPools(poolInfos);
      */

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

  // Tokens do Aegis Protocol na devnet
  const tokenMap: Record<string, string> = {
    'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9': 'AEGIS',
    'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3': 'AERO',
    '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc': 'ABTC',
    'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys': 'AUSD',
    '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15': 'ASOL',
    // Tokens comuns na devnet
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
    'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9': 'Aegis Token',
    'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3': 'Aero Token',
    '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc': 'Aegis Bitcoin',
    'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys': 'Aegis USD',
    '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15': 'Aegis SOL',
    // Tokens comuns na devnet
    'So11111111111111111111111111111112': 'Solana',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USD Coin',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'Tether USD',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'Ethereum',
    '2FPyCwUReMandcnypmxvT6DvdDB8NXW19TGa1Y1EAhZg': 'Bitcoin',
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfWB782': 'Marinade SOL',
  };

  return tokenMap[mintStr] || `Token ${mintStr.slice(0, 8)}`;
}