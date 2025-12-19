"use client";

export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { useRealPools } from "@/src/hooks/useRealPools";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import PoolDetailClient from "./PoolDetailClient";

function getProgramId(): PublicKey | undefined {
  const programIdStr = process.env.NEXT_PUBLIC_AEGIS_PROGRAM_ID;
  if (!programIdStr) return undefined;
  try {
    return new PublicKey(programIdStr);
  } catch {
    return undefined;
  }
}

export default function PoolDetail({ params }: { params: { slug: string } }) {
  const programId = useMemo(() => getProgramId(), []);
  const { pools, loading } = useRealPools(programId);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading pool...</div>
      </div>
    );
  }

  const pool = pools.find((p) => p.slug === params.slug);
  if (!pool) return notFound();

  return <PoolDetailClient pool={pool} />;
}
