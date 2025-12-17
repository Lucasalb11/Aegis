"use client";

import { notFound } from "next/navigation";
import { useRealPools } from "@/src/hooks/useRealPools";
import { PublicKey } from "@solana/web3.js";
import PoolDetailClient from "./PoolDetailClient";

const PROGRAM_ID = process.env.NEXT_PUBLIC_AEGIS_PROGRAM_ID
  ? new PublicKey(process.env.NEXT_PUBLIC_AEGIS_PROGRAM_ID)
  : undefined;

export default function PoolDetail({ params }: { params: { slug: string } }) {
  const { pools, loading } = useRealPools(PROGRAM_ID);
  
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
