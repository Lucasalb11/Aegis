import Link from "next/link";
import { Pool } from "@/src/types/pool";

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function PoolCard({ pool }: { pool: Pool }) {
  return (
    <div className="card-surface p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {pool.tokens.map((t) => (
              <img
                key={t.symbol}
                src={t.icon}
                alt={`${t.symbol} icon`}
                className="w-10 h-10 rounded-full border-2 border-background-dark object-cover"
              />
            ))}
          </div>
          <div>
            <p className="text-white text-lg font-semibold">{pool.name}</p>
            <p className="text-white/60 text-sm">APR {pool.apr.toFixed(2)}%</p>
          </div>
        </div>
        <Link
          href={`/pools/${pool.slug}`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          View
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Metric label="TVL" value={formatUsd(pool.tvlUsd)} />
        <Metric label="Volume (24h)" value={formatUsd(pool.volume24hUsd)} />
        <Metric label="Fees (24h)" value={formatUsd(pool.fees24hUsd)} />
        <Metric label="APR" value={`${pool.apr.toFixed(2)}%`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-white/60 text-xs">{label}</p>
      <p className="text-white text-base font-semibold">{value}</p>
    </div>
  );
}
