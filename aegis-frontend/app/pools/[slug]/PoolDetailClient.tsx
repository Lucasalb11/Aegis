"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Pool } from "@/src/types/pool";
import { TopNav } from "@/components/TopNav";
import { useAprManager } from "@/src/hooks/useAprManager";

function formatUsd(value: number, opts?: Intl.NumberFormatOptions) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2, ...opts })}`;
}

export default function PoolDetailClient({ pool }: { pool: Pool }) {
  const [managedPool] = useAprManager([pool]);
  const [tokenA, tokenB] = managedPool.tokens;
  const difference = managedPool.ilComparison.current - managedPool.ilComparison.hodl;
  const differencePct = (difference / managedPool.ilComparison.hodl) * 100;

  const historyTabs = useMemo(() => managedPool.history ?? [], [managedPool.history]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav active="/pools" />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
        <div className="flex flex-wrap justify-between items-start gap-6">
          <div className="flex items-center gap-4">
            <Link
              href="/pools"
              className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-white/10 transition-colors text-white/60"
            >
              ←
            </Link>
            <div className="flex -space-x-4">
              <img
                className="w-12 h-12 rounded-full border-2 border-background-dark"
                alt={`${tokenA.symbol} icon`}
                src={tokenA.icon}
              />
              <img
                className="w-12 h-12 rounded-full border-2 border-background-dark"
                alt={`${tokenB.symbol} icon`}
                src={tokenB.icon}
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-4xl font-black leading-tight tracking-tight">{managedPool.name}</h1>
              <p className="text-white/60 text-base">
                Manage your liquidity e acompanhe APR com histórico iniciado agora.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-11 px-6 rounded-lg bg-primary/20 text-primary text-sm font-bold tracking-wide hover:bg-primary/30 transition-colors">
              Remove
            </button>
            <button className="h-11 px-6 rounded-lg bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors">
              Add Liquidity
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="Total Liquidity"
                value={formatUsd(managedPool.tvlUsd, { maximumFractionDigits: 0 })}
              />
              <StatCard
                label="Volume (24h)"
                value={formatUsd(managedPool.volume24hUsd, { maximumFractionDigits: 0 })}
              />
              <StatCard
                label="Fees (24h)"
                value={formatUsd(managedPool.fees24hUsd, { maximumFractionDigits: 0 })}
              />
            </div>

            <div className="card-surface p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-white text-lg font-bold">Historical Performance (APR)</p>
                  <p className="text-white/60 text-xs">Atualiza automaticamente a cada poucos segundos.</p>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-white/5 p-1 text-xs">
                  {historyTabs.map((point, idx) => (
                    <span
                      key={point.label}
                      className={`px-3 py-1 rounded ${
                        idx === 0 ? "bg-primary/20 text-white" : "text-white/70 hover:bg-white/5"
                      }`}
                    >
                      {point.label}: {point.apr.toFixed(2)}%
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-64 w-full flex items-center justify-center text-white/60 text-sm border border-white/10 rounded-lg">
                Chart placeholder (hook up to real metrics)
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="card-surface p-6 flex flex-col gap-4">
              <h3 className="text-white text-lg font-bold">Pool Composition</h3>
              <div className="flex flex-col gap-3">
                {[tokenA, tokenB].map((t) => (
                  <div key={t.symbol} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <img alt={`${t.symbol} token icon`} className="w-6 h-6 rounded-full" src={t.icon} />
                      <span className="text-white font-medium">{t.symbol}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">
                        {t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-white/60 text-sm">{formatUsd(t.usd)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-surface p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-bold">Impermanent Loss</h3>
                <span className="text-xs font-medium px-2 py-1 rounded bg-accent-orange/20 text-accent-orange">
                  vs HODL
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <Row label="Initial Investment" value={formatUsd(managedPool.ilComparison.initial)} />
                <Row label="Value if Held (HODL)" value={formatUsd(managedPool.ilComparison.hodl)} />
                <Row label="Current Value in Pool" value={formatUsd(managedPool.ilComparison.current)} />
                <div className="border-t border-white/10 my-1" />
                <Row
                  label="Difference"
                  value={`${difference >= 0 ? "+" : ""}${formatUsd(difference)} (${differencePct.toFixed(2)}%)`}
                  valueClass={difference >= 0 ? "text-green-400" : "text-red-400"}
                />
                <p className="text-white/60 text-xs text-center mt-2">
                  Não inclui fees acumuladas; quando conectarmos à devnet exibiremos dados reais.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface p-6 flex flex-col gap-2">
      <p className="text-white/60 text-sm font-medium">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/60 text-sm">{label}</span>
      <span className={`text-white font-medium ${valueClass || ""}`}>{value}</span>
    </div>
  );
}
