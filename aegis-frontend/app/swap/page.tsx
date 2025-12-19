"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { TopNav } from "@/components/TopNav";
import { TokenSelector } from "@/components/TokenSelector";
import { useAegis } from "@/src/providers/AegisProvider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { usePools, TokenInfo } from "@/src/hooks/usePools";
import { useSwap } from "@/src/hooks/useSwap";

// Fallback tokens that are always available (Aegis minted tokens)
const AEGIS_TOKENS_DATA = [
  { address: 'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9', symbol: 'AEGIS', name: 'Aegis Token', decimals: 6 },
  { address: 'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3', symbol: 'AERO', name: 'Aero Token', decimals: 6 },
  { address: '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc', symbol: 'ABTC', name: 'Aegis Bitcoin', decimals: 6 },
  { address: 'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys', symbol: 'AUSD', name: 'Aegis USD', decimals: 6 },
  { address: '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15', symbol: 'ASOL', name: 'Aegis SOL', decimals: 6 },
];

function toLamports(amount: number, decimals: number) {
  const factor = 10 ** decimals;
  return BigInt(Math.floor(amount * factor));
}

export default function SwapPage() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const { aegisClient, programId } = useAegis();
  const { availableTokens, getPoolForTokens, loading: poolsLoading } = usePools(programId || undefined);
  
  // Create fallback tokens on client side
  const [fallbackTokens, setFallbackTokens] = useState<TokenInfo[]>([]);
  
  useEffect(() => {
    // Initialize fallback tokens on client side
    try {
      const tokens = AEGIS_TOKENS_DATA.map(t => ({
        mint: new PublicKey(t.address),
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
      }));
      setFallbackTokens(tokens);
    } catch (err) {
      console.error('[SwapPage] Error creating fallback tokens:', err);
    }
  }, []);
  
  // Combine available tokens with fallback tokens
  const allTokens = useMemo(() => {
    const tokenMap = new Map<string, TokenInfo>();
    
    // Add fallback tokens first
    fallbackTokens.forEach(token => {
      tokenMap.set(token.mint.toString(), token);
    });
    
    // Add available tokens from pools (may override)
    availableTokens.forEach(token => {
      tokenMap.set(token.mint.toString(), token);
    });
    
    return Array.from(tokenMap.values());
  }, [availableTokens, fallbackTokens]);

  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1); // percent
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate swap quote
  const { quote, loading: quoteLoading } = useSwap(
    fromToken?.mint || null,
    toToken?.mint || null,
    amount,
    slippage
  );

  const canSwap = connected && aegisClient && programId && fromToken && toToken && amount && quote && !loading;

  // Check if token pair has an available pool
  const hasPool = useMemo(() => {
    if (!fromToken || !toToken) return false;
    return getPoolForTokens(fromToken.mint, toToken.mint) !== null;
  }, [fromToken, toToken, getPoolForTokens]);

  const handleSwap = async () => {
    setError(null);
    setLoading(true);
    setStatus("Preparing swap...");
    
    try {
      if (!connected || !publicKey) {
        throw new Error("Please connect your wallet first.");
      }
      
      if (!aegisClient) {
        throw new Error("Aegis client not initialized. Please reconnect your wallet.");
      }
      
      if (!fromToken || !toToken) {
        throw new Error("Please select both tokens.");
      }
      
      if (!hasPool) {
        throw new Error("No liquidity pool found for this token pair.");
      }
      
      if (!amount || Number(amount) <= 0) {
        throw new Error("Please enter a valid amount greater than zero.");
      }

      if (!signTransaction) {
        throw new Error("Wallet does not support signing transactions.");
      }

      // Fetch on-chain decimals to convert to integer units
      setStatus("Fetching token information...");
      const [fromMintInfo, toMintInfo] = await Promise.all([
        getMint(connection, fromToken.mint),
        getMint(connection, toToken.mint),
      ]);

      // Check and create ATAs if needed
      setStatus("Checking token accounts...");
      
      const fromAta = await getAssociatedTokenAddress(fromToken.mint, publicKey);
      const toAta = await getAssociatedTokenAddress(toToken.mint, publicKey);

      const ataInstructions: any[] = [];

      // Check source token account
      try {
        const sourceAccount = await getAccount(connection, fromAta);
        const sourceBalance = Number(sourceAccount.amount) / Math.pow(10, fromMintInfo.decimals);
        
        if (sourceBalance < Number(amount)) {
          throw new Error(`Insufficient ${fromToken.symbol} balance. You have ${sourceBalance.toFixed(6)}, need ${amount}`);
        }
      } catch (e: any) {
        if (e.message?.includes('Insufficient')) {
          throw e;
        }
        // Account doesn't exist
        throw new Error(`You don't have any ${fromToken.symbol}. Get some from the Faucet first.`);
      }

      // Check destination token account, create if needed
      try {
        await getAccount(connection, toAta);
      } catch {
        console.log(`[Swap] Creating ATA for ${toToken.symbol}`);
        ataInstructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey,
            toAta,
            publicKey,
            toToken.mint
          )
        );
      }

      // Create ATAs if needed
      if (ataInstructions.length > 0) {
        setStatus("Creating token account for output token...");
        
        const ataTransaction = new Transaction();
        ataInstructions.forEach(ix => ataTransaction.add(ix));
        
        const { blockhash } = await connection.getLatestBlockhash();
        ataTransaction.recentBlockhash = blockhash;
        ataTransaction.feePayer = publicKey;

        const signedTx = await signTransaction(ataTransaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid, 'confirmed');
        
        console.log(`[Swap] Created ATA: ${txid}`);
      }

      // Calculate amounts
      const amountBn = new BN(toLamports(Number(amount), fromMintInfo.decimals).toString());
      
      // Use quote for min amount out
      const minOutBn = quote?.minAmountOut || new BN(
        toLamports(Number(amount) * (1 - slippage / 100), toMintInfo.decimals).toString()
      );

      setStatus("Executing swap...");
      
      const sig = await aegisClient.swap({
        fromMint: fromToken.mint,
        toMint: toToken.mint,
        amountIn: amountBn,
        minAmountOut: minOutBn,
      });

      setStatus(`Swap successful! Transaction: ${sig.slice(0, 8)}...${sig.slice(-8)}`);
      setAmount("");
      setLoading(false);
      
    } catch (err: any) {
      console.error('[Swap] Error:', err);
      setError(err.message || "Error executing swap");
      setStatus(null);
      setLoading(false);
    }
  };

  const handleTokenSwitch = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav active="/swap" />
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.08em] text-white/60">AMM Swap</p>
          <h1 className="text-3xl font-black tracking-tight">Swap Tokens</h1>
          <p className="text-white/60 text-sm">
            Swap tokens using Aegis AMM liquidity pools on Solana devnet
          </p>
        </div>

        {poolsLoading && (
          <div className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">
            Loading available pools...
          </div>
        )}

        {!connected && (
          <div className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 p-3 text-sm text-accent-orange">
            Connect your wallet to swap tokens.
          </div>
        )}

        {allTokens.length === 0 && !poolsLoading && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-400">
            No tokens available. Get some test tokens from the Faucet first!
          </div>
        )}

        <div className="card-surface p-6 flex flex-col gap-4">
          {/* Input token */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">From</label>
            <TokenSelector
              tokens={allTokens}
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
              disabled={(!fromToken && !toToken) || loading}
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
              tokens={allTokens}
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
              disabled={loading}
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
                  <div className={`font-mono ${quote.priceImpact > 5 ? 'text-red-400' : quote.priceImpact > 1 ? 'text-yellow-400' : 'text-white'}`}>
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
              <div className="text-center text-white/60 flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Calculating quote...
              </div>
            </div>
          )}

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/70">Slippage Tolerance (%)</span>
            <div className="flex gap-2">
              {[0.5, 1, 2, 5].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`px-3 py-1 rounded text-xs ${
                    slippage === val
                      ? 'bg-primary text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {val}%
                </button>
              ))}
              <input
                className="input flex-1 text-center"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={slippage}
                onChange={(e) => setSlippage(Number(e.target.value))}
                disabled={loading}
              />
            </div>
          </label>

          {!hasPool && fromToken && toToken && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
              No liquidity pool found for {fromToken.symbol} → {toToken.symbol}. 
              <br />
              <span className="text-xs">Try a different pair or create this pool first.</span>
            </div>
          )}

          <button
            className="h-12 px-6 rounded-lg bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!canSwap || !hasPool}
            onClick={handleSwap}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : !connected ? (
              "Connect Wallet"
            ) : !hasPool && fromToken && toToken ? (
              "Pool Unavailable"
            ) : (
              "Swap"
            )}
          </button>

          {status && (
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
              {status}
            </div>
          )}
          
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/70">
          <p className="font-semibold text-white">How to use Aegis Swap</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Get test tokens from the <a href="/faucet" className="text-primary hover:underline">Faucet</a></li>
            <li>Select the tokens you want to swap</li>
            <li>Token accounts are created automatically if needed</li>
            <li>Slippage protects against price changes during transaction</li>
            <li>All swaps happen on Solana devnet</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
