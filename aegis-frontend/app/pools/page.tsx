"use client";

import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { PoolCard } from "@/components/PoolCard";
import { mockPools } from "@/src/data/pools";
import { useAprManager } from "@/src/hooks/useAprManager";

export default function PoolsPage() {
  const pools = useAprManager(mockPools);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav active="/pools" />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.08em] text-white/60">Discover</p>
            <h1 className="text-3xl font-black tracking-tight">Liquidity Pools</h1>
            <p className="text-white/60 text-sm">
              Dados mockados enquanto preparamos pools na devnet — APR ao vivo com histórico iniciado agora.
            </p>
          </div>
          <Link
            href="/pools/create"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            Create Pool
          </Link>
        </div>

        <div className="mb-8 p-4 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-bold mb-2">Oracle Integration</h2>
          <p className="text-white/60 text-sm mb-4">
            Pools now support integrated price oracles for enhanced security and accurate pricing.
            Configure oracles to enable advanced features like slippage protection and price-based operations.
          </p>
          <div className="flex gap-2">
            <Link
              href="/pools/oracle-config"
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/90 transition-colors"
            >
              Configure Oracle
            </Link>
            <span className="text-xs text-white/40 self-center">
              (Manual oracle for devnet testing)
            </span>
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pools.map((pool) => (
            <PoolCard key={pool.slug} pool={pool} />
          ))}
        </div>
      </main>
    </div>
  );
}
