/**
 * Hook to fetch and convert real on-chain pool data to UI format
 */

import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { usePools, PoolInfo } from './usePools';
import { Pool } from '@/src/types/pool';
import { calculatePoolTVL, generatePoolSlug, generatePoolName, getTokenMetadata } from '@/src/utils/poolData';

export function useRealPools(programId?: PublicKey) {
  const { connection } = useConnection();
  const { pools: poolInfos, loading, error, refreshPools, lastUpdate } = usePools(programId);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const fetchPoolMetrics = useCallback(async () => {
    if (!connection || poolInfos.length === 0) {
      setPools([]);
      return;
    }

    setLoadingMetrics(true);

    try {
      const poolsWithMetrics = await Promise.all(
        poolInfos.map(async (poolInfo) => {
          try {
            // Calculate real metrics
            const metrics = await calculatePoolTVL(connection, poolInfo);
            
            // Get token metadata
            const [tokenAInfo, tokenBInfo] = await Promise.all([
              getTokenMetadata(connection, poolInfo.mintA),
              getTokenMetadata(connection, poolInfo.mintB),
            ]);

            // Generate historical APR data (simplified - in production, fetch from historical data)
            const history = [
              { label: '1D', apr: metrics.apr },
              { label: '1W', apr: metrics.apr * 0.99 },
              { label: '1M', apr: metrics.apr * 1.01 },
              { label: '3M', apr: metrics.apr * 0.98 },
              { label: '1Y', apr: metrics.apr * 0.95 },
            ];

            // Calculate IL comparison (simplified)
            const initialInvestment = 10000;
            const hodlValue = initialInvestment * 1.1; // Assume 10% price appreciation
            const currentValue = initialInvestment * (1 + metrics.apr / 100 / 365); // Daily APR

            const pool: Pool = {
              slug: generatePoolSlug(poolInfo.mintA, poolInfo.mintB),
              name: generatePoolName(poolInfo.mintA, poolInfo.mintB),
              pair: `${tokenAInfo.symbol}/${tokenBInfo.symbol}`,
              tokens: [
                {
                  symbol: tokenAInfo.symbol,
                  icon: tokenAInfo.icon || '',
                  amount: metrics.tokenA.amount,
                  usd: metrics.tokenA.usd,
                },
                {
                  symbol: tokenBInfo.symbol,
                  icon: tokenBInfo.icon || '',
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

            return pool;
          } catch (err) {
            console.error('Error fetching metrics for pool:', poolInfo.publicKey.toString(), err);
            return null;
          }
        })
      );

      // Filter out null values
      const validPools = poolsWithMetrics.filter((p): p is Pool => p !== null);
      setPools(validPools);
    } catch (err) {
      console.error('Error fetching pool metrics:', err);
      setPools([]);
    } finally {
      setLoadingMetrics(false);
    }
  }, [connection, poolInfos]);

  useEffect(() => {
    fetchPoolMetrics();
  }, [fetchPoolMetrics]);

  return {
    pools,
    loading: loading || loadingMetrics,
    error,
    refreshPools,
    lastUpdate,
  };
}
