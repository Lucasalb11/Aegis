import { useState, useEffect, useMemo } from 'react';
import { BN, Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { usePools, PoolInfo } from './usePools';

export interface SwapQuote {
  amountOut: BN;
  minAmountOut: BN;
  fee: BN;
  priceImpact: number;
  pool: PoolInfo;
}

export function useSwap(
  fromToken: PublicKey | null,
  toToken: PublicKey | null,
  amountIn: string,
  slippage: number = 1
) {
  const { connection } = useConnection();
  const { getPoolForTokens } = usePools();
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = useMemo(() => {
    if (!fromToken || !toToken) return null;
    return getPoolForTokens(fromToken, toToken);
  }, [fromToken, toToken, getPoolForTokens]);

  const calculateSwapQuote = async () => {
    if (!pool || !fromToken || !toToken || !amountIn || Number(amountIn) <= 0) {
      setQuote(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Buscar saldos dos vaults
      const [vaultAInfo, vaultBInfo] = await Promise.all([
        connection.getTokenAccountBalance(pool.vaultA),
        connection.getTokenAccountBalance(pool.vaultB),
      ]);

      const reserveA = new BN(vaultAInfo.value.amount);
      const reserveB = new BN(vaultBInfo.value.amount);

      // Determinar se é A->B ou B->A
      const aToB = fromToken.equals(pool.mintA);

      const [reserveIn, reserveOut] = aToB ? [reserveA, reserveB] : [reserveB, reserveA];

      // Calcular amount out usando fórmula constant product
      const amountInBN = new BN(Math.floor(Number(amountIn) * 10 ** 6)); // Assumindo 6 decimais

      if (amountInBN.gte(reserveIn)) {
        throw new Error('Amount in too large');
      }

      // amountInAfterFee = amountIn * (10000 - feeBps) / 10000
      const amountInAfterFee = amountInBN
        .mul(new BN(10000 - pool.feeBps))
        .div(new BN(10000));

      // newReserveIn = reserveIn + amountInAfterFee
      const newReserveIn = reserveIn.add(amountInAfterFee);

      // k = reserveIn * reserveOut
      const k = reserveIn.mul(reserveOut);

      // newReserveOut = k / newReserveIn
      const newReserveOut = k.div(newReserveIn);

      // amountOut = reserveOut - newReserveOut
      const amountOut = reserveOut.sub(newReserveOut);

      // Calcular fee
      const fee = amountInBN.sub(amountInAfterFee);

      // Calcular slippage mínimo
      const slippageMultiplier = new BN(Math.floor((100 - slippage) * 100));
      const minAmountOut = amountOut.mul(slippageMultiplier).div(new BN(10000));

      // Calcular price impact aproximado
      const priceImpact = amountInBN.mul(new BN(100)).div(reserveIn).toNumber() / 100;

      setQuote({
        amountOut,
        minAmountOut,
        fee,
        priceImpact,
        pool,
      });
    } catch (err: any) {
      console.error('Failed to calculate quote:', err);
      setError(err.message || 'Failed to calculate swap quote');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateSwapQuote();
  }, [pool, fromToken, toToken, amountIn, slippage]);

  return {
    quote,
    loading,
    error,
    refetch: calculateSwapQuote,
  };
}