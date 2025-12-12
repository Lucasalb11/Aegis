"use client";

import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { Pool } from "@/src/types/pool";
import { TokenInfo } from "@/src/hooks/usePools";
import { useAegis } from "@/src/providers/AegisProvider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

interface AddLiquidityModalProps {
  pool: Pool;
  onClose: () => void;
}

export function AddLiquidityModal({ pool, onClose }: AddLiquidityModalProps) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { aegisClient } = useAegis();

  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tokenA, tokenB] = pool.tokens;

  const canAddLiquidity = connected && aegisClient && amountA && amountB && Number(amountA) > 0 && Number(amountB) > 0;

  const handleAddLiquidity = async () => {
    setError(null);
    setStatus("Preparando adição de liquidez...");

    try {
      if (!canAddLiquidity) throw new Error("Conecte a Phantom e informe os valores.");
      if (!publicKey) throw new Error("Carteira não conectada.");

      // For now, use default decimals (6) since we don't have real mint data
      // In production, this would fetch real mint info from the pool data
      const decimalsA = 6; // Default USDC/SOL decimals
      const decimalsB = 6;

      const amountABN = new BN(Math.floor(Number(amountA) * 10 ** decimalsA));
      const amountBBN = new BN(Math.floor(Number(amountB) * 10 ** decimalsB));

      setStatus("Adicionando liquidez...");

      // For now, this will fail since we need real pool data from blockchain
      // We'll need to implement proper pool fetching and liquidity operations
      throw new Error("Funcionalidade de adição de liquidez ainda não implementada completamente.");

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao adicionar liquidez");
      setStatus(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-background-dark border border-white/10 rounded-xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-bold">Add Liquidity</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <p className="text-white/60 text-sm mb-2">Pool: {pool.name}</p>
            <div className="flex items-center gap-2">
              <img src={tokenA.icon} alt={tokenA.symbol} className="w-6 h-6 rounded-full" />
              <span className="text-white font-medium">{tokenA.symbol}</span>
              <span className="text-white/60">/</span>
              <img src={tokenB.icon} alt={tokenB.symbol} className="w-6 h-6 rounded-full" />
              <span className="text-white font-medium">{tokenB.symbol}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-white/70 mb-2">
                Amount {tokenA.symbol}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder="0.00"
                className="w-full input"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">
                Amount {tokenB.symbol}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder="0.00"
                className="w-full input"
              />
            </div>
          </div>

          {!connected && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 text-sm">Conecte sua carteira Phantom para continuar</p>
            </div>
          )}

          <button
            onClick={handleAddLiquidity}
            disabled={!canAddLiquidity}
            className="w-full h-11 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {!connected ? "Conectar Phantom" : "Add Liquidity"}
          </button>

          {status && <p className="text-white/80 text-sm text-center">{status}</p>}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}