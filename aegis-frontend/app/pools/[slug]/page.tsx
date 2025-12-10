import { notFound } from "next/navigation";
import { mockPools } from "@/src/data/pools";
import PoolDetailClient from "./PoolDetailClient";

export default function PoolDetail({ params }: { params: { slug: string } }) {
  const pool = mockPools.find((p) => p.slug === params.slug);
  if (!pool) return notFound();

  return <PoolDetailClient pool={pool} />;
}
