"use client";

import { useEffect, useMemo, useState } from "react";
import { HistoricalPoint, Pool } from "@/src/types/pool";

const HORIZONS: { label: HistoricalPoint["label"]; damping: number; slope: number }[] = [
  { label: "1D", damping: 0.65, slope: 0.0 },
  { label: "1W", damping: 0.75, slope: -0.03 },
  { label: "1M", damping: 0.82, slope: -0.05 },
  { label: "3M", damping: 0.9, slope: -0.08 },
  { label: "1Y", damping: 0.95, slope: -0.12 },
];

function pseudoRandom(seed: string, step: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  const x = Math.sin(h + step * 1.37) * 43758.5453;
  return x - Math.floor(x);
}

function computeBaseApr(pool: Pool) {
  const feeApr = pool.tvlUsd > 0 ? (pool.fees24hUsd / pool.tvlUsd) * 365 * 100 : 0;
  const volumeRatio = pool.tvlUsd > 0 ? pool.volume24hUsd / pool.tvlUsd : 0;
  const boost = 1 + 0.08 * Math.tanh(volumeRatio - 1); // suaviza impacto de volume
  const blended = 0.65 * pool.apr + 0.35 * feeApr;
  return Math.max(0, Number((blended * boost).toFixed(2)));
}

function seedHistory(baseApr: number, seed: string): HistoricalPoint[] {
  return HORIZONS.map((h, idx) => {
    const noise = (pseudoRandom(`${seed}-${h.label}`, idx) - 0.5) * 0.5; // +-0.25pp
    const apr = Math.max(0, Number((baseApr * (1 + h.slope) + noise).toFixed(2)));
    return { label: h.label, apr };
  });
}

function nextHistory(history: HistoricalPoint[], targetApr: number, seed: string, step: number) {
  return HORIZONS.map((h) => {
    const current = history.find((p) => p.label === h.label)?.apr ?? targetApr;
    const desired = targetApr * (1 + h.slope);
    const pull = (desired - current) * (1 - h.damping);
    const noise = (pseudoRandom(`${seed}-${h.label}`, step) - 0.5) * 0.35; // +-0.175pp
    const apr = Math.max(0, Number((current + pull + noise).toFixed(2)));
    return { label: h.label, apr };
  });
}

/**
 * Gera e mantém histórico de APR em memória com atualizações suaves.
 * - Inicializa a partir dos dados atuais.
 * - Recalcula periodicamente com base em fees/tvl/volume.
 */
export function useAprManager(pools: Pool[], refreshMs = 15000) {
  const seededPools = useMemo(() => {
    const now = Date.now();
    return pools.map((pool) => {
      const baseApr = computeBaseApr(pool);
      return {
        ...pool,
        apr: baseApr,
        history: seedHistory(baseApr, pool.slug || String(now)),
      };
    });
  }, [pools]);

  const [managedPools, setManagedPools] = useState<Pool[]>(seededPools);

  // Re-seed when the base pools change (e.g., navigation or new data)
  useEffect(() => {
    setManagedPools(seededPools);
  }, [seededPools]);

  // Periodic intelligent updates
  useEffect(() => {
    const interval = setInterval(() => {
      setManagedPools((prev) =>
        prev.map((pool, idx) => {
          const basePool = pools[idx] ?? pool;
          const targetApr = computeBaseApr(basePool);
          const history = nextHistory(pool.history, targetApr, pool.slug, Math.floor(Date.now() / refreshMs));
          const latestApr = history[0]?.apr ?? targetApr;
          return { ...pool, apr: latestApr, history };
        }),
      );
    }, refreshMs);

    return () => clearInterval(interval);
  }, [pools, refreshMs]);

  return managedPools;
}
