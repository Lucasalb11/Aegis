"use client";

import { useMemo } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PoolInfo } from "@/src/hooks/usePools";

interface PoolStatsProps {
  pools: PoolInfo[];
}

export function PoolStats({ pools }: PoolStatsProps) {
  const { connection } = useConnection();

  const stats = useMemo(() => {
    const totalPools = pools.length;
    const totalLiquidity = pools.reduce((sum, pool) => {
      // Simplificação: assumir valores aproximados
      return sum + (pool.lpSupply.toNumber() / 1_000_000); // Converter para unidades legíveis
    }, 0);

    const uniqueTokens = new Set<string>();
    pools.forEach(pool => {
      uniqueTokens.add(pool.mintA.toString());
      uniqueTokens.add(pool.mintB.toString());
    });

    return {
      totalPools,
      totalLiquidity: Math.round(totalLiquidity),
      uniqueTokens: uniqueTokens.size,
    };
  }, [pools]);

  if (pools.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="card-surface p-4">
        <div className="text-2xl font-bold text-primary">{stats.totalPools}</div>
        <div className="text-sm text-white/60">Pools Ativos</div>
      </div>

      <div className="card-surface p-4">
        <div className="text-2xl font-bold text-primary">{stats.totalLiquidity.toLocaleString()}</div>
        <div className="text-sm text-white/60">Liquidez Total</div>
      </div>

      <div className="card-surface p-4">
        <div className="text-2xl font-bold text-primary">{stats.uniqueTokens}</div>
        <div className="text-sm text-white/60">Tokens Disponíveis</div>
      </div>
    </div>
  );
}