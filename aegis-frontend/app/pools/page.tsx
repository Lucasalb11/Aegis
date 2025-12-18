"use client";

import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { PoolCard } from "@/components/PoolCard";
import { useRealPools } from "@/src/hooks/useRealPools";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useState } from "react";

function getProgramId(): PublicKey | undefined {
  const programIdStr = process.env.NEXT_PUBLIC_AEGIS_PROGRAM_ID;
  if (!programIdStr) {
    console.warn("[PoolsPage] NEXT_PUBLIC_AEGIS_PROGRAM_ID not configured");
    return undefined;
  }
  try {
    return new PublicKey(programIdStr);
  } catch (err) {
    console.error("[PoolsPage] Invalid program ID:", err);
    return undefined;
  }
}

export default function PoolsPage() {
  const [programId] = useState(() => getProgramId());
  const { pools, loading, error, refreshPools, lastUpdate } = useRealPools(programId);

  useEffect(() => {
    if (programId) {
      console.log(`[PoolsPage] Using program ID: ${programId.toString()}`);
    } else {
      console.warn("[PoolsPage] Program ID not configured. Pools will not load.");
    }
  }, [programId]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav active="/pools" />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.08em] text-white/60">Discover</p>
            <h1 className="text-3xl font-black tracking-tight">Liquidity Pools</h1>
            <p className="text-white/60 text-sm">
              {loading
                ? "Loading pools from blockchain..."
                : pools.length > 0
                ? `Showing ${pools.length} active pools • Last updated: ${lastUpdate?.toLocaleTimeString()}`
                : "No pools found. Create your first pool to get started!"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refreshPools}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
            >
              Refresh
            </button>
            <Link
              href="/pools/create"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Create Pool
            </Link>
          </div>
        </div>

        {!programId && (
          <div className="mb-8 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <p className="text-yellow-400 text-sm font-semibold mb-1">⚠️ Program ID Not Configured</p>
            <p className="text-yellow-300/80 text-sm">
              NEXT_PUBLIC_AEGIS_PROGRAM_ID is not set. Please configure it in your environment variables.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-red-400 text-sm font-semibold mb-1">❌ Error Loading Pools</p>
            <p className="text-red-300/80 text-sm">
              {error}
            </p>
            <p className="text-red-300/60 text-xs mt-2">
              Make sure you're connected to the correct network (devnet) and the program is deployed.
            </p>
          </div>
        )}

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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white/60">Loading pools from blockchain...</div>
          </div>
        ) : pools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-white/60 mb-4">No pools found on-chain.</p>
            <Link
              href="/pools/create"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Create Your First Pool
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pools.map((pool) => (
              <PoolCard key={pool.slug} pool={pool} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
