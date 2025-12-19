"use client";

export const dynamic = 'force-dynamic';

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

  // Calculate swap quote
  const { quote, loading: quoteLoading } = useSwap(
    fromToken?.mint || null,
    toToken?.mint || null,
    amount,
    slippage
  );

  const canSwap = connected && aegisClient && programId && fromToken && toToken && amount && quote;

  // Check if token pair has an available pool
  const hasPool = useMemo(() => {
    if (!fromToken || !toToken) return false;
    return getPoolForTokens(fromToken.mint, toToken.mint) !== null;
  }, [fromToken, toToken, getPoolForTokens]);

  const handleSwap = async () => {
    setError(null);
    setStatus("Preparing swap...");
    try {
      if (!canSwap) throw new Error("Connect Phantom and select tokens.");
      if (!fromToken || !toToken) throw new Error("Select both tokens.");
      if (!hasPool) throw new Error("Pool not found for this token pair.");
      if (!amount || Number(amount) <= 0) throw new Error("Enter a value greater than zero.");

      // Fetch on-chain decimals to convert to integer units
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

      setStatus("Executing swap...");
      const sig = await aegisClient.swap({
        fromMint: fromToken.mint,
        toMint: toToken.mint,
        amountIn: amountBn,
        minAmountOut: minOutBn,
      });

      setStatus(`Swap executed: ${sig}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error executing swap");
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
          <h1 className="text-3xl font-black tracking-tight">Swap Tokens</h1>
          <p className="text-white/60 text-sm">
            Select tokens available in Aegis AMM liquidity pools
          </p>
        </div>

        {poolsLoading && (
          <div className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">
            Loading available pools...
          </div>
        )}

        {!connected && (
          <div className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">
            Connect Phantom to continue.
          </div>
        )}

        {availableTokens.length === 0 && !poolsLoading && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-400">
            No liquidity pools found. Create pools first in the "Pools" tab.
          </div>
        )}

        <div className="card-surface p-6 flex flex-col gap-4">
          {/* Input token */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">From</label>
            <TokenSelector
              tokens={availableTokens}
              selectedToken={fromToken}
              onSelect={setFromToken}
              placeholder="Select input token"
              excludeToken={toToken?.mint}
            />
          </div>

          {/* Button to swap tokens */}
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

          {/* Output token */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">To</label>
            <TokenSelector
              tokens={availableTokens}
              selectedToken={toToken}
              onSelect={setToToken}
              placeholder="Select output token"
              excludeToken={fromToken?.mint}
            />
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/70">Amount</span>
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

          {/* Swap Information */}
          {quote && !quoteLoading && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
              <h3 className="font-semibold text-white">Swap Summary</h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/60">You will receive:</span>
                  <div className="text-white font-mono">
                    ≈ {(Number(quote.amountOut.toString()) / 1_000_000).toFixed(6)} {toToken?.symbol}
                  </div>
                </div>
                <div>
                  <span className="text-white/60">Minimum guaranteed:</span>
                  <div className="text-white font-mono">
                    {(Number(quote.minAmountOut.toString()) / 1_000_000).toFixed(6)} {toToken?.symbol}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/60">Fee:</span>
                  <div className="text-white font-mono">
                    {(Number(quote.fee.toString()) / 1_000_000).toFixed(6)} {fromToken?.symbol}
                  </div>
                </div>
                <div>
                  <span className="text-white/60">Price impact:</span>
                  <div className="text-white font-mono">
                    {quote.priceImpact.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="text-xs text-white/60">
                Pool: {fromToken?.symbol}/{toToken?.symbol} • Fee: {quote.pool.feeBps / 100}%
              </div>
            </div>
          )}

          {quoteLoading && amount && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-center text-white/60">Calculating quote...</div>
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
              Pool not found for {fromToken.symbol} → {toToken.symbol}
            </div>
          )}

          <button
            className="h-11 px-6 rounded-lg bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-60"
            disabled={!canSwap || !hasPool}
            onClick={handleSwap}
          >
            {!connected ? "Connect Phantom" :
             !hasPool ? "Pool Unavailable" :
             "Swap"}
          </button>

          {status && <p className="text-white/80 text-sm">Status: {status}</p>}
          {error && <p className="text-red-400 text-sm">Error: {error}</p>}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/70">
          <p className="font-semibold text-white">About Aegis AMM</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Only tokens with active liquidity pools are shown</li>
            <li>Swaps use constant-product formula (x * y = k)</li>
            <li>Slippage protects against price changes during transaction</li>
            <li>Make sure you have ATAs for both tokens</li>
          </ul>
        </div>
      </main>
    </div>
  );
}