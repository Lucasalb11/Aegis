/**
 * Hook to fetch user analytics data: balance evolution, fees collected, PnL
 */

import { useEffect, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { usePools, PoolInfo } from './usePools';
import { getTokenPrice, getTokenMetadata } from '@/src/utils/poolData';

export interface BalanceSnapshot {
  timestamp: number;
  totalUsd: number;
  lpPositions: Array<{
    pool: string;
    lpTokens: number;
    valueUsd: number;
  }>;
  tokenBalances: Array<{
    mint: string;
    symbol: string;
    amount: number;
    valueUsd: number;
  }>;
}

export interface FeeData {
  totalFeesUsd: number;
  feesByPool: Array<{
    pool: string;
    feesUsd: number;
  }>;
  fees24hUsd: number;
  fees7dUsd: number;
  fees30dUsd: number;
}

export interface PnLData {
  totalPnLUsd: number;
  pnLPercentage: number;
  initialInvestmentUsd: number;
  currentValueUsd: number;
  pnLByPool: Array<{
    pool: string;
    pnLUsd: number;
    pnLPercentage: number;
  }>;
}

export interface AnalyticsData {
  balanceHistory: BalanceSnapshot[];
  fees: FeeData;
  pnl: PnLData;
  totalSwaps: number;
  totalLiquidityProvided: number;
  activePools: number;
}

export function useAnalytics(programId?: PublicKey) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { pools } = usePools(programId);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!connection || !publicKey || !connected || !programId) {
      setAnalytics(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's LP token positions
      const lpPositions: Array<{
        pool: string;
        lpTokens: number;
        valueUsd: number;
        poolInfo: PoolInfo;
      }> = [];

      for (const poolInfo of pools) {
        try {
          const lpMint = poolInfo.lpMint;
          const userLpAta = await getAssociatedTokenAddress(lpMint, publicKey);
          
          try {
            const lpAccount = await getAccount(connection, userLpAta);
            const lpBalance = Number(lpAccount.amount);
            
            if (lpBalance > 0) {
              // Calculate user's share of the pool
              const lpSupply = Number(poolInfo.lpSupply.toString());
              const userShare = lpBalance / lpSupply;
              
              // Get pool vault balances
              const [vaultA, vaultB] = await Promise.all([
                getAccount(connection, poolInfo.vaultA).catch(() => null),
                getAccount(connection, poolInfo.vaultB).catch(() => null),
              ]);

              if (vaultA && vaultB) {
                const [tokenAInfo, tokenBInfo] = await Promise.all([
                  getTokenMetadata(connection, poolInfo.mintA),
                  getTokenMetadata(connection, poolInfo.mintB),
                ]);

                const priceA = getTokenPrice(poolInfo.mintA);
                const priceB = getTokenPrice(poolInfo.mintB);

                const amountA = (Number(vaultA.amount) / Math.pow(10, tokenAInfo.decimals)) * userShare;
                const amountB = (Number(vaultB.amount) / Math.pow(10, tokenBInfo.decimals)) * userShare;

                const valueUsd = amountA * priceA + amountB * priceB;

                lpPositions.push({
                  pool: `${tokenAInfo.symbol}/${tokenBInfo.symbol}`,
                  lpTokens: lpBalance / Math.pow(10, 6), // Assuming 6 decimals for LP tokens
                  valueUsd,
                  poolInfo,
                });
              }
            }
          } catch {
            // User doesn't have LP tokens for this pool
          }
        } catch (err) {
          console.warn('Error fetching LP position:', err);
        }
      }

      // Get token balances (non-LP tokens)
      const tokenBalances: Array<{
        mint: string;
        symbol: string;
        amount: number;
        valueUsd: number;
      }> = [];

      // Get SOL balance
      const solBalance = await connection.getBalance(publicKey);
      const solAmount = solBalance / 1e9;
      const solPrice = getTokenPrice(new PublicKey('So1111111111111111111111111111111112'));
      tokenBalances.push({
        mint: 'So1111111111111111111111111111111112',
        symbol: 'SOL',
        amount: solAmount,
        valueUsd: solAmount * solPrice,
      });

      // Calculate totals
      const totalLpValue = lpPositions.reduce((sum, pos) => sum + pos.valueUsd, 0);
      const totalTokenValue = tokenBalances.reduce((sum, bal) => sum + bal.valueUsd, 0);
      const totalUsd = totalLpValue + totalTokenValue;

      // Generate balance history (simplified - in production, fetch from historical data)
      const now = Date.now();
      const balanceHistory: BalanceSnapshot[] = [];
      const days = 30;
      
      for (let i = days; i >= 0; i--) {
        const timestamp = now - i * 24 * 60 * 60 * 1000;
        // Simulate balance evolution (in production, fetch from historical data)
        const variation = (Math.random() - 0.5) * 0.1; // ±5% daily variation
        const historicalValue = totalUsd * (1 + variation * (days - i) / days);
        
        balanceHistory.push({
          timestamp,
          totalUsd: Math.max(0, historicalValue),
          lpPositions: lpPositions.map(pos => ({
            pool: pos.pool,
            lpTokens: pos.lpTokens,
            valueUsd: pos.valueUsd * (historicalValue / totalUsd),
          })),
          tokenBalances: tokenBalances.map(bal => ({
            mint: bal.mint,
            symbol: bal.symbol,
            amount: bal.amount,
            valueUsd: bal.valueUsd * (historicalValue / totalUsd),
          })),
        });
      }

      // Calculate fees (simplified - in production, fetch from transaction history)
      const feesByPool = lpPositions.map(pos => ({
        pool: pos.pool,
        feesUsd: pos.valueUsd * 0.01 * (pos.poolInfo.feeBps / 10000), // Estimate fees as 1% of position value
      }));

      const totalFeesUsd = feesByPool.reduce((sum, f) => sum + f.feesUsd, 0);
      const fees24hUsd = totalFeesUsd * 0.1;
      const fees7dUsd = totalFeesUsd * 0.3;
      const fees30dUsd = totalFeesUsd;

      const fees: FeeData = {
        totalFeesUsd,
        feesByPool,
        fees24hUsd,
        fees7dUsd,
        fees30dUsd,
      };

      // Calculate PnL (simplified - assumes initial investment was 80% of current value)
      const initialInvestmentUsd = totalUsd * 0.8;
      const totalPnLUsd = totalUsd - initialInvestmentUsd;
      const pnLPercentage = initialInvestmentUsd > 0 ? (totalPnLUsd / initialInvestmentUsd) * 100 : 0;

      const pnLByPool = lpPositions.map(pos => {
        const initialValue = pos.valueUsd * 0.8;
        const pnL = pos.valueUsd - initialValue;
        return {
          pool: pos.pool,
          pnLUsd: pnL,
          pnLPercentage: initialValue > 0 ? (pnL / initialValue) * 100 : 0,
        };
      });

      const pnl: PnLData = {
        totalPnLUsd,
        pnLPercentage,
        initialInvestmentUsd,
        currentValueUsd: totalUsd,
        pnLByPool,
      };

      const analyticsData: AnalyticsData = {
        balanceHistory,
        fees,
        pnl,
        totalSwaps: Math.floor(Math.random() * 50) + 10, // Mock data
        totalLiquidityProvided: totalLpValue,
        activePools: lpPositions.length,
      };

      setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Failed to fetch analytics');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, connected, programId, pools]);

  useEffect(() => {
    fetchAnalytics();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refresh: fetchAnalytics,
  };
}
