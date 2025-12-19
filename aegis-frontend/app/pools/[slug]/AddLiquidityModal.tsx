"use client";

import { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { Pool } from "@/src/types/pool";
import { useAegis } from "@/src/providers/AegisProvider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { usePools, PoolInfo } from "@/src/hooks/usePools";

// Token metadata mapping
const TOKEN_MINTS: Record<string, string> = {
  'AEGIS': 'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9',
  'AERO': 'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3',
  'ABTC': '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc',
  'AUSD': 'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys',
  'ASOL': '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15',
};

interface AddLiquidityModalProps {
  pool: Pool;
  onClose: () => void;
}

export function AddLiquidityModal({ pool, onClose }: AddLiquidityModalProps) {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const { aegisClient, programId } = useAegis();
  const { pools: onChainPools } = usePools(programId || undefined);

  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [onChainPool, setOnChainPool] = useState<PoolInfo | null>(null);

  const [tokenA, tokenB] = pool.tokens;

  // Find the corresponding on-chain pool
  useEffect(() => {
    if (onChainPools.length > 0) {
      const matchingPool = onChainPools.find(p => {
        const mintAStr = p.mintA.toString();
        const mintBStr = p.mintB.toString();
        const expectedMintA = TOKEN_MINTS[tokenA.symbol];
        const expectedMintB = TOKEN_MINTS[tokenB.symbol];
        
        return (
          (mintAStr === expectedMintA && mintBStr === expectedMintB) ||
          (mintAStr === expectedMintB && mintBStr === expectedMintA)
        );
      });
      
      setOnChainPool(matchingPool || null);
    }
  }, [onChainPools, tokenA.symbol, tokenB.symbol]);

  const canAddLiquidity = connected && aegisClient && onChainPool && 
    amountA && amountB && Number(amountA) > 0 && Number(amountB) > 0;

  const handleAddLiquidity = async () => {
    setError(null);
    setLoading(true);
    setStatus("Preparing to add liquidity...");

    try {
      if (!connected || !publicKey) {
        throw new Error("Please connect your wallet first.");
      }

      if (!aegisClient) {
        throw new Error("Aegis client not initialized. Please reconnect your wallet.");
      }

      if (!onChainPool) {
        throw new Error("Pool not found on-chain. This may be a demo pool.");
      }

      if (!signTransaction) {
        throw new Error("Wallet does not support signing transactions.");
      }

      const decimalsA = 6;
      const decimalsB = 6;

      const amountABN = new BN(Math.floor(Number(amountA) * 10 ** decimalsA));
      const amountBBN = new BN(Math.floor(Number(amountB) * 10 ** decimalsB));

      setStatus("Checking token accounts...");

      // Get or create user's ATAs
      const userTokenA = await getAssociatedTokenAddress(
        onChainPool.mintA,
        publicKey
      );
      const userTokenB = await getAssociatedTokenAddress(
        onChainPool.mintB,
        publicKey
      );
      const userLpToken = await getAssociatedTokenAddress(
        onChainPool.lpMint,
        publicKey
      );

      // Check which ATAs need to be created
      const atasToCreate: PublicKey[] = [];
      const ataInstructions: any[] = [];

      try {
        await getAccount(connection, userTokenA);
      } catch {
        atasToCreate.push(userTokenA);
        ataInstructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userTokenA,
            publicKey,
            onChainPool.mintA
          )
        );
      }

      try {
        await getAccount(connection, userTokenB);
      } catch {
        atasToCreate.push(userTokenB);
        ataInstructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userTokenB,
            publicKey,
            onChainPool.mintB
          )
        );
      }

      try {
        await getAccount(connection, userLpToken);
      } catch {
        atasToCreate.push(userLpToken);
        ataInstructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userLpToken,
            publicKey,
            onChainPool.lpMint
          )
        );
      }

      // Create missing ATAs if needed
      if (ataInstructions.length > 0) {
        setStatus(`Creating ${ataInstructions.length} token account(s)...`);
        
        const ataTransaction = new Transaction();
        ataInstructions.forEach(ix => ataTransaction.add(ix));
        
        const { blockhash } = await connection.getLatestBlockhash();
        ataTransaction.recentBlockhash = blockhash;
        ataTransaction.feePayer = publicKey;

        const signedTx = await signTransaction(ataTransaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid, 'confirmed');
        
        console.log(`[AddLiquidity] Created ATAs: ${txid}`);
      }

      setStatus("Adding liquidity to pool...");

      // Get the pool from SDK
      const sdkPool = await aegisClient.getPool(onChainPool.mintA, onChainPool.mintB);
      
      if (!sdkPool) {
        throw new Error("Failed to fetch pool from SDK");
      }

      // Add liquidity
      const result = await sdkPool.addLiquidity(
        { amountA: amountABN, amountB: amountBBN },
        userTokenA,
        userTokenB,
        userLpToken
      );

      setStatus(`Liquidity added successfully! You received LP tokens.`);
      setLoading(false);

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('[AddLiquidity] Error:', err);
      setError(err.message || "Failed to add liquidity");
      setStatus(null);
      setLoading(false);
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
          {/* Pool Info */}
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <p className="text-white/60 text-sm mb-2">Pool: {pool.name}</p>
            <div className="flex items-center gap-2">
              <img src={tokenA.icon} alt={tokenA.symbol} className="w-6 h-6 rounded-full" />
              <span className="text-white font-medium">{tokenA.symbol}</span>
              <span className="text-white/60">/</span>
              <img src={tokenB.icon} alt={tokenB.symbol} className="w-6 h-6 rounded-full" />
              <span className="text-white font-medium">{tokenB.symbol}</span>
            </div>
            {!onChainPool && (
              <p className="text-yellow-400 text-xs mt-2">
                ⚠️ This is a demo pool. Create it on-chain first.
              </p>
            )}
          </div>

          {/* Amount Inputs */}
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
                disabled={loading}
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
                disabled={loading}
              />
            </div>
          </div>

          {/* Pool Ratio Info */}
          {onChainPool && pool.tvlUsd > 0 && (
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-white/60 text-xs">
                Current Pool Ratio: {tokenA.symbol} / {tokenB.symbol}
              </p>
              <p className="text-white/60 text-xs">
                TVL: ${pool.tvlUsd.toLocaleString()}
              </p>
            </div>
          )}

          {/* Warnings */}
          {!connected && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 text-sm">Connect your wallet to continue</p>
            </div>
          )}

          {connected && !onChainPool && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-orange-400 text-sm">
                This pool doesn't exist on-chain yet. You can only add liquidity to real pools.
              </p>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleAddLiquidity}
            disabled={!canAddLiquidity || loading}
            className="w-full h-11 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            ) : !onChainPool ? (
              "Pool Not Available"
            ) : (
              "Add Liquidity"
            )}
          </button>

          {/* Status Messages */}
          {status && (
            <p className="text-white/80 text-sm text-center">{status}</p>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Info */}
          <div className="text-xs text-white/50 text-center">
            <p>You will receive LP tokens representing your share of the pool.</p>
            <p>Make sure you have enough tokens in your wallet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
