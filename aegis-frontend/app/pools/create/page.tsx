"use client";

import { useState, useMemo, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { TopNav } from "@/components/TopNav";
import { TokenSelector } from "@/components/TokenSelector";
import { useAegis } from "@/src/providers/AegisProvider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { usePools, TokenInfo } from "@/src/hooks/usePools";

// Common token mint addresses (as strings to avoid SSR issues)
const COMMON_TOKEN_DATA = [
  {
    mint: "So11111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
  },
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  {
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    symbol: "ETH",
    name: "Ethereum",
    decimals: 8,
  },
];

export default function CreatePoolPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { aegisClient, programId } = useAegis();
  const { availableTokens, refreshPools } = usePools(programId || undefined);

  const [tokenA, setTokenA] = useState<TokenInfo | null>(null);
  const [tokenB, setTokenB] = useState<TokenInfo | null>(null);
  const [feeBps, setFeeBps] = useState(30); // 0.3%
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commonTokens, setCommonTokens] = useState<TokenInfo[]>([]);

  // Initialize common tokens on client side
  useEffect(() => {
    const tokens = COMMON_TOKEN_DATA.map(data => ({
      ...data,
      mint: new PublicKey(data.mint),
    }));
    setCommonTokens(tokens);
  }, []);

  const allTokens = useMemo(() => [...commonTokens, ...availableTokens], [commonTokens, availableTokens]);

  const canCreatePool = connected && aegisClient && programId && tokenA && tokenB && tokenA.mint.toString() !== tokenB.mint.toString();

  const handleCreatePool = async () => {
    setError(null);
    setStatus("Preparando criação do pool...");

    try {
      if (!canCreatePool) throw new Error("Conecte a Phantom e selecione tokens diferentes.");
      if (!tokenA || !tokenB) throw new Error("Selecione ambos os tokens.");
      if (tokenA.mint.equals(tokenB.mint)) throw new Error("Tokens devem ser diferentes.");

      setStatus("Criando pool...");

      // Use getOrCreatePool method from AegisClient
      const pool = await aegisClient.getOrCreatePool(tokenA.mint, tokenB.mint, feeBps);

      setStatus(`Pool criado com sucesso! Endereço: ${pool.info.address.toString()}`);

      // Refresh pools list
      refreshPools();

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao criar pool");
      setStatus(null);
    }
  };

  const handleTokenSwitch = () => {
    setTokenA(tokenB);
    setTokenB(tokenA);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav active="/pools" />
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.08em] text-white/60">Create</p>
          <h1 className="text-3xl font-black tracking-tight">New Liquidity Pool</h1>
          <p className="text-white/60 text-sm">
            Create a new AMM pool between two tokens to enable trading and liquidity provision.
          </p>
        </div>

        {!connected && (
          <div className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">
            Conecte a Phantom para continuar.
          </div>
        )}

        <div className="card-surface p-6 flex flex-col gap-4">
          {/* Token A */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Token A</label>
            <TokenSelector
              tokens={allTokens}
              selectedToken={tokenA}
              onSelect={setTokenA}
              placeholder="Selecione o primeiro token"
              excludeToken={tokenB?.mint}
            />
          </div>

          {/* Botão para trocar tokens */}
          <div className="flex justify-center">
            <button
              onClick={handleTokenSwitch}
              className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors"
              disabled={!tokenA && !tokenB}
            >
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* Token B */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Token B</label>
            <TokenSelector
              tokens={allTokens}
              selectedToken={tokenB}
              onSelect={setTokenB}
              placeholder="Selecione o segundo token"
              excludeToken={tokenA?.mint}
            />
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/70">Taxa do Pool (bps)</span>
            <input
              className="input"
              type="number"
              min="1"
              max="1000"
              step="1"
              value={feeBps}
              onChange={(e) => setFeeBps(Number(e.target.value))}
              placeholder="30"
            />
            <span className="text-xs text-white/60">
              Taxa em basis points (bps). 30 bps = 0.3%. Valor recomendado: 20-50 bps.
            </span>
          </label>

          <button
            className="h-11 px-6 rounded-lg bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-60"
            disabled={!canCreatePool}
            onClick={handleCreatePool}
          >
            {!connected ? "Conectar Phantom" :
             !tokenA || !tokenB ? "Selecionar Tokens" :
             tokenA.mint.equals(tokenB.mint) ? "Tokens Devem Ser Diferentes" :
             "Criar Pool"}
          </button>

          {status && <p className="text-white/80 text-sm">Status: {status}</p>}
          {error && <p className="text-red-400 text-sm">Erro: {error}</p>}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/70">
          <p className="font-semibold text-white">Sobre Criação de Pools</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>A ordem dos tokens é automaticamente organizada (mintA &lt; mintB)</li>
            <li>O pool criará vaults para armazenar os tokens</li>
            <li>Um token LP será criado para representar participação na liquidez</li>
            <li>A taxa é cobrada em cada swap e distribuída proporcionalmente aos provedores de liquidez</li>
          </ul>
        </div>
      </main>
    </div>
  );
}