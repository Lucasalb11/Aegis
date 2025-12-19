/**
 * Hook that combines real on-chain pools with mock data for demo purposes
 * - Uses real pools when available on-chain
 * - Falls back to mock pools when no on-chain data exists
 * - Merges real and mock data for better UX
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { usePools, PoolInfo } from './usePools';
import { Pool } from '@/src/types/pool';
import { mockPools } from '@/src/data/pools';
import { calculatePoolTVL, generatePoolSlug, generatePoolName, getTokenMetadata } from '@/src/utils/poolData';

// Token icons for known Aegis tokens
const TOKEN_ICONS: Record<string, string> = {
  'AEGIS': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOc2v63wG7G_vjriVQDPKbl7GcaOeGugQjhP8XT1sFfVW8IfMfB1yWMRRAXNRMOeUsJP_-31PoYUzTqUY0NuZrff-G8j-5vxc-pds83pc--J7NrJJcBWxVTDjl0Edg6ElQRDnApc4Sji6B-46nn_WFo_mdrZBq8lp1jzklSZT6AK20QIuDn4ojmefNJWVkAKP9B7Ib0GNUJRv5nS_gbCivNBtV4PnWpNeodiQkGenvtgnJGdf3xUBJyiyuw7vnWNJRhlk3KKzNvn1L',
  'AUSD': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAykMhiUJhX_Q_0jS-jnKFU-knoD1oau_n2p2Ru_xQDpK1kPTWnYPZOKImrwQEAm_4aJeuLM4wsaI7X2nxCoTAWtoBY_gTKvOSe07nl4KEuCPr6kRml2G9wNhtMdA4FfidRYKxWy99Vh0nMeI59vq6EmIiI8R2iSU-GhRt1cVySx0xdNpfoVNXsY9AbODho7szpVt1CIxYIdL0mSqQn-nX1JtMhpLei1TOloY7gMDHjmbmWapt9WsQXT1Z4gYIt4PX7C_B1rdxSaB70',
  'AERO': 'https://assets.coingecko.com/coins/images/17752/small/mSOL.png?1696516777',
  'ABTC': 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg?1696528245',
  'ASOL': 'https://assets.coingecko.com/coins/images/17752/small/mSOL.png?1696516777',
};

export interface HybridPoolsOptions {
  useMockAsDefault?: boolean;
  showMockWhenEmpty?: boolean;
}

export function useHybridPools(
  programId?: PublicKey,
  options: HybridPoolsOptions = {}
) {
  const { useMockAsDefault = true, showMockWhenEmpty = true } = options;
  
  const { connection } = useConnection();
  const { pools: poolInfos, loading, error, refreshPools, lastUpdate } = usePools(programId);
  const [realPools, setRealPools] = useState<Pool[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Convert on-chain pool data to UI format
  const fetchPoolMetrics = useCallback(async () => {
    if (!connection || poolInfos.length === 0) {
      setRealPools([]);
      setLoadingMetrics(false);
      return;
    }

    setLoadingMetrics(true);

    try {
      console.log(`[useHybridPools] Fetching metrics for ${poolInfos.length} on-chain pools`);
      
      const poolsWithMetrics = await Promise.all(
        poolInfos.map(async (poolInfo) => {
          try {
            // Calculate real metrics from on-chain data
            const metrics = await calculatePoolTVL(connection, poolInfo);
            
            // Get token metadata
            const [tokenAInfo, tokenBInfo] = await Promise.all([
              getTokenMetadata(connection, poolInfo.mintA).catch(() => ({
                symbol: 'UNKNOWN',
                name: 'Unknown Token',
                decimals: 6,
                icon: undefined,
              })),
              getTokenMetadata(connection, poolInfo.mintB).catch(() => ({
                symbol: 'UNKNOWN',
                name: 'Unknown Token',
                decimals: 6,
                icon: undefined,
              })),
            ]);

            // Get icons from our mapping
            const iconA = TOKEN_ICONS[tokenAInfo.symbol] || tokenAInfo.icon || '';
            const iconB = TOKEN_ICONS[tokenBInfo.symbol] || tokenBInfo.icon || '';

            // Generate historical APR data (estimated)
            const history = [
              { label: '1D', apr: metrics.apr },
              { label: '1W', apr: metrics.apr * (0.95 + Math.random() * 0.1) },
              { label: '1M', apr: metrics.apr * (0.90 + Math.random() * 0.2) },
              { label: '3M', apr: metrics.apr * (0.85 + Math.random() * 0.3) },
              { label: '1Y', apr: metrics.apr * (0.80 + Math.random() * 0.4) },
            ];

            // Calculate IL comparison (simplified)
            const initialInvestment = 10000;
            const hodlValue = initialInvestment * (1 + Math.random() * 0.2);
            const currentValue = initialInvestment * (1 + metrics.apr / 100 / 12);

            const pool: Pool = {
              slug: generatePoolSlug(poolInfo.mintA, poolInfo.mintB),
              name: generatePoolName(poolInfo.mintA, poolInfo.mintB),
              pair: `${tokenAInfo.symbol}/${tokenBInfo.symbol}`,
              tokens: [
                {
                  symbol: tokenAInfo.symbol,
                  icon: iconA,
                  amount: metrics.tokenA.amount,
                  usd: metrics.tokenA.usd,
                },
                {
                  symbol: tokenBInfo.symbol,
                  icon: iconB,
                  amount: metrics.tokenB.amount,
                  usd: metrics.tokenB.usd,
                },
              ],
              tvlUsd: metrics.tvlUsd,
              volume24hUsd: metrics.volume24hUsd,
              fees24hUsd: metrics.fees24hUsd,
              apr: metrics.apr,
              ilComparison: {
                initial: initialInvestment,
                hodl: hodlValue,
                current: currentValue,
              },
              history,
            };

            console.log(`[useHybridPools] Processed real pool: ${pool.slug}`);
            return pool;
          } catch (err: any) {
            console.error(`[useHybridPools] Error processing pool:`, err);
            return null;
          }
        })
      );

      const validPools = poolsWithMetrics.filter((p): p is Pool => p !== null);
      console.log(`[useHybridPools] Processed ${validPools.length} real pools`);
      setRealPools(validPools);
    } catch (err: any) {
      console.error('[useHybridPools] Error fetching pool metrics:', err);
      setRealPools([]);
    } finally {
      setLoadingMetrics(false);
    }
  }, [connection, poolInfos]);

  useEffect(() => {
    fetchPoolMetrics();
  }, [fetchPoolMetrics]);

  // Combine real and mock pools
  const hybridPools = useMemo(() => {
    // If we have real pools, prioritize them
    if (realPools.length > 0) {
      // Create a map of real pool slugs
      const realPoolSlugs = new Set(realPools.map(p => p.slug));
      
      // Add mock pools that don't exist on-chain (for demo completeness)
      const additionalMockPools = mockPools.filter(
        mock => !realPoolSlugs.has(mock.slug)
      );

      // Return real pools first, then unique mock pools
      return [...realPools, ...additionalMockPools];
    }

    // If no real pools and mock is enabled as default, show mock
    if (showMockWhenEmpty && useMockAsDefault) {
      return mockPools;
    }

    return [];
  }, [realPools, useMockAsDefault, showMockWhenEmpty]);

  // Check if we're using mock data
  const isMockData = useMemo(() => {
    return realPools.length === 0 && hybridPools.length > 0;
  }, [realPools.length, hybridPools.length]);

  // Get a specific pool by slug
  const getPoolBySlug = useCallback((slug: string): Pool | undefined => {
    return hybridPools.find(p => p.slug === slug);
  }, [hybridPools]);

  // Get pool by token pair
  const getPoolByPair = useCallback((tokenA: string, tokenB: string): Pool | undefined => {
    const slug1 = `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}`;
    const slug2 = `${tokenB.toLowerCase()}-${tokenA.toLowerCase()}`;
    return hybridPools.find(p => p.slug === slug1 || p.slug === slug2);
  }, [hybridPools]);

  // Refresh all pools
  const refreshAllPools = useCallback(() => {
    refreshPools();
  }, [refreshPools]);

  return {
    pools: hybridPools,
    realPools,
    mockPools,
    loading: loading || loadingMetrics,
    error,
    isMockData,
    refreshPools: refreshAllPools,
    lastUpdate,
    getPoolBySlug,
    getPoolByPair,
  };
}

export default useHybridPools;
