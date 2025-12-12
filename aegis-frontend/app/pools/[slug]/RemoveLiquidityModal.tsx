"use client";

import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { Pool } from "@/src/types/pool";
import { useAegis } from "@/src/providers/AegisProvider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

interface RemoveLiquidityModalProps {
  pool: Pool;
  onClose: () => void;
}

export function RemoveLiquidityModal({ pool, onClose }: RemoveLiquidityModalProps) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { aegisClient } = useAegis();

  const [lpAmount, setLpAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tokenA, tokenB] = pool.tokens;

  const canRemoveLiquidity = connected && aegisClient && lpAmount && Number(lpAmount) > 0;

  const handleRemoveLiquidity = async () => {
    setError(null);
    setStatus("Preparando remoção de liquidez...");

    try {
      if (!canRemoveLiquidity) throw new Error("Conecte a Phantom e informe a quantidade.");
      if (!publicKey) throw new Error("Carteira não conectada.");

      const lpAmountBN = new BN(lpAmount);

      setStatus("Removendo liquidez...");

      // For now, this will fail since we need real pool data from blockchain
      // We'll need to implement proper pool fetching and liquidity operations
      throw new Error("Funcionalidade de remoção de liquidez ainda não implementada completamente.");

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao remover liquidez");
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
          <h2 className="text-white text-xl font-bold">Remove Liquidity</h2>
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

          <div>
            <label className="block text-sm text-white/70 mb-2">
              LP Tokens to Burn
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={lpAmount}
              onChange={(e) => setLpAmount(e.target.value)}
              placeholder="0.00"
              className="w-full input"
            />
            <p className="text-xs text-white/60 mt-1">
              Quantidade de tokens LP a serem queimados
            </p>
          </div>

          {!connected && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 text-sm">Conecte sua carteira Phantom para continuar</p>
            </div>
          )}

          <button
            onClick={handleRemoveLiquidity}
            disabled={!canRemoveLiquidity}
            className="w-full h-11 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {!connected ? "Conectar Phantom" : "Remove Liquidity"}
          </button>

          {status && <p className="text-white/80 text-sm text-center">{status}</p>}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}