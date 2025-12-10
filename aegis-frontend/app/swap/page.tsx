"use client";

import { useState, useMemo } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { TopNav } from "@/components/TopNav";
import { TokenSelector } from "@/components/TokenSelector";
import { useAegis } from "@/src/providers/AegisProvider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { usePools, TokenInfo } from "@/src/hooks/usePools";
import { useSwap } from "@/src/hooks/useSwap";

function toLamports(amount: number, decimals: number) {
  const factor = 10 ** decimals;
  return BigInt(Math.floor(amount * factor));
}

export default function SwapPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { aegisClient, programId } = useAegis();
  const { availableTokens, getPoolForTokens, loading: poolsLoading } = usePools(programId || undefined);

  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1); // percent
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calcular cotação do swap
  const { quote, loading: quoteLoading } = useSwap(
    fromToken?.mint || null,
    toToken?.mint || null,
    amount,
    slippage
  );

  const canSwap = connected && aegisClient && programId && fromToken && toToken && amount && quote;

  // Verificar se o par de tokens tem um pool disponível
  const hasPool = useMemo(() => {
    if (!fromToken || !toToken) return false;
    return getPoolForTokens(fromToken.mint, toToken.mint) !== null;
  }, [fromToken, toToken, getPoolForTokens]);

  const handleSwap = async () => {
    setError(null);
    setStatus("Preparando swap...");
    try {
      if (!canSwap) throw new Error("Conecte a Phantom e selecione os tokens.");
      if (!fromToken || !toToken) throw new Error("Selecione ambos os tokens.");
      if (!hasPool) throw new Error("Pool não encontrado para este par de tokens.");
      if (!amount || Number(amount) <= 0) throw new Error("Informe um valor maior que zero.");

      // Buscar decimais on-chain para converter para unidades inteiras
      const [fromMintInfo, toMintInfo] = await Promise.all([
        getMint(connection, fromToken.mint),
        getMint(connection, toToken.mint),
      ]);

      const amountBn = new BN(toLamports(Number(amount), fromMintInfo.decimals).toString());
      const minOutLamports = toLamports(
        Number(amount) * (1 - slippage / 100),
        toMintInfo.decimals,
      );
      const minOutBn = new BN(minOutLamports.toString());

      setStatus("Executando swap...");
      const sig = await aegisClient.swap({
        fromMint: fromToken.mint,
        toMint: toToken.mint,
        amountIn: amountBn,
        minAmountOut: minOutBn,
      });

      setStatus(`Swap executado: ${sig}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao executar swap");
      setStatus(null);
    }
  };

  const handleTokenSwitch = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav active="/swap" />
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.08em] text-white/60">AMM Swap</p>
          <h1 className="text-3xl font-black tracking-tight">Trocar tokens</h1>
          <p className="text-white/60 text-sm">
            Selecione tokens disponíveis nos pools de liquidez do Aegis AMM
          </p>
        </div>

        {poolsLoading && (
          <div className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">
            Carregando pools disponíveis...
          </div>
        )}

        {!connected && (
          <div className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">
            Conecte a Phantom para continuar.
          </div>
        )}

        {availableTokens.length === 0 && !poolsLoading && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-400">
            Nenhum pool de liquidez encontrado. Crie pools primeiro na aba "Pools".
          </div>
        )}

        <div className="card-surface p-6 flex flex-col gap-4">
          {/* Token de entrada */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">De</label>
            <TokenSelector
              tokens={availableTokens}
              selectedToken={fromToken}
              onSelect={setFromToken}
              placeholder="Selecione token de entrada"
              excludeToken={toToken?.mint}
            />
          </div>

          {/* Botão para trocar tokens */}
          <div className="flex justify-center">
            <button
              onClick={handleTokenSwitch}
              className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors"
              disabled={!fromToken && !toToken}
            >
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* Token de saída */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Para</label>
            <TokenSelector
              tokens={availableTokens}
              selectedToken={toToken}
              onSelect={setToToken}
              placeholder="Selecione token de saída"
              excludeToken={fromToken?.mint}
            />
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/70">Quantidade</span>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>

          {/* Informações do Swap */}
          {quote && !quoteLoading && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
              <h3 className="font-semibold text-white">Resumo do Swap</h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/60">Você receberá:</span>
                  <div className="text-white font-mono">
                    ≈ {(Number(quote.amountOut.toString()) / 1_000_000).toFixed(6)} {toToken?.symbol}
                  </div>
                </div>
                <div>
                  <span className="text-white/60">Mínimo garantido:</span>
                  <div className="text-white font-mono">
                    {(Number(quote.minAmountOut.toString()) / 1_000_000).toFixed(6)} {toToken?.symbol}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/60">Taxa:</span>
                  <div className="text-white font-mono">
                    {(Number(quote.fee.toString()) / 1_000_000).toFixed(6)} {fromToken?.symbol}
                  </div>
                </div>
                <div>
                  <span className="text-white/60">Impacto no preço:</span>
                  <div className="text-white font-mono">
                    {quote.priceImpact.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="text-xs text-white/60">
                Pool: {fromToken?.symbol}/{toToken?.symbol} • Taxa: {quote.pool.feeBps / 100}%
              </div>
            </div>
          )}

          {quoteLoading && amount && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-center text-white/60">Calculando cotação...</div>
            </div>
          )}

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/70">Slippage (%)</span>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
            />
          </label>

          {!hasPool && fromToken && toToken && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
              Pool não encontrado para {fromToken.symbol} → {toToken.symbol}
            </div>
          )}

          <button
            className="h-11 px-6 rounded-lg bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-60"
            disabled={!canSwap || !hasPool}
            onClick={handleSwap}
          >
            {!connected ? "Conectar Phantom" :
             !hasPool ? "Pool Indisponível" :
             "Swap"}
          </button>

          {status && <p className="text-white/80 text-sm">Status: {status}</p>}
          {error && <p className="text-red-400 text-sm">Erro: {error}</p>}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/70">
          <p className="font-semibold text-white">Sobre o Aegis AMM</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Apenas tokens com pools de liquidez ativos são mostrados</li>
            <li>Swaps usam fórmula constant-product (x * y = k)</li>
            <li>Slippage protege contra mudanças de preço durante a transação</li>
            <li>Certifique-se de ter ATAs para ambos os tokens</li>
          </ul>
        </div>
      </main>
    </div>
  );
}