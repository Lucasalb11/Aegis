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

interface RemoveLiquidityModalProps {
  pool: Pool;
  onClose: () => void;
}

export function RemoveLiquidityModal({ pool, onClose }: RemoveLiquidityModalProps) {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const { aegisClient, programId } = useAegis();
  const { pools: onChainPools } = usePools(programId || undefined);

  const [lpAmount, setLpAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [onChainPool, setOnChainPool] = useState<PoolInfo | null>(null);
  const [userLpBalance, setUserLpBalance] = useState<string | null>(null);

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

  // Fetch user's LP token balance
  useEffect(() => {
    const fetchLpBalance = async () => {
      if (!connection || !publicKey || !onChainPool) {
        setUserLpBalance(null);
        return;
      }

      try {
        const userLpAta = await getAssociatedTokenAddress(
          onChainPool.lpMint,
          publicKey
        );

        const account = await getAccount(connection, userLpAta);
        const balance = Number(account.amount) / Math.pow(10, 6); // Assuming 6 decimals
        setUserLpBalance(balance.toFixed(6));
      } catch {
        setUserLpBalance("0");
      }
    };

    fetchLpBalance();
  }, [connection, publicKey, onChainPool]);

  const canRemoveLiquidity = connected && aegisClient && onChainPool && 
    lpAmount && Number(lpAmount) > 0 && 
    userLpBalance && Number(lpAmount) <= Number(userLpBalance);

  const handleSetMax = () => {
    if (userLpBalance) {
      setLpAmount(userLpBalance);
    }
  };

  const handleRemoveLiquidity = async () => {
    setError(null);
    setLoading(true);
    setStatus("Preparing to remove liquidity...");

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

      const decimals = 6;
      const lpAmountBN = new BN(Math.floor(Number(lpAmount) * 10 ** decimals));

      setStatus("Checking token accounts...");

      // Get user's ATAs
      const userLpToken = await getAssociatedTokenAddress(
        onChainPool.lpMint,
        publicKey
      );
      const userTokenA = await getAssociatedTokenAddress(
        onChainPool.mintA,
        publicKey
      );
      const userTokenB = await getAssociatedTokenAddress(
        onChainPool.mintB,
        publicKey
      );

      // Check if ATAs exist, create if needed
      const ataInstructions: any[] = [];

      try {
        await getAccount(connection, userTokenA);
      } catch {
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
        ataInstructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userTokenB,
            publicKey,
            onChainPool.mintB
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
        
        console.log(`[RemoveLiquidity] Created ATAs: ${txid}`);
      }

      setStatus("Removing liquidity from pool...");

      // Get the pool from SDK
      const sdkPool = await aegisClient.getPool(onChainPool.mintA, onChainPool.mintB);
      
      if (!sdkPool) {
        throw new Error("Failed to fetch pool from SDK");
      }

      // Remove liquidity
      const result = await sdkPool.removeLiquidity(
        { lpAmount: lpAmountBN },
        userLpToken,
        userTokenA,
        userTokenB
      );

      setStatus(`Liquidity removed successfully! Tokens returned to your wallet.`);
      setLoading(false);

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('[RemoveLiquidity] Error:', err);
      setError(err.message || "Failed to remove liquidity");
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
          <h2 className="text-white text-xl font-bold">Remove Liquidity</h2>
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

          {/* LP Balance */}
          {connected && onChainPool && (
            <div className="p-3 bg-white/5 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Your LP Balance:</span>
                <span className="text-white font-mono">
                  {userLpBalance !== null ? userLpBalance : "Loading..."}
                </span>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-white/70">
                LP Tokens to Burn
              </label>
              {userLpBalance && Number(userLpBalance) > 0 && (
                <button
                  onClick={handleSetMax}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Max
                </button>
              )}
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={lpAmount}
              onChange={(e) => setLpAmount(e.target.value)}
              placeholder="0.00"
              className="w-full input"
              disabled={loading}
            />
            <p className="text-xs text-white/60 mt-1">
              Enter the amount of LP tokens to burn and receive underlying tokens
            </p>
          </div>

          {/* Validation Messages */}
          {lpAmount && userLpBalance && Number(lpAmount) > Number(userLpBalance) && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">
                Insufficient LP balance. You have {userLpBalance} LP tokens.
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
                This pool doesn't exist on-chain yet.
              </p>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleRemoveLiquidity}
            disabled={!canRemoveLiquidity || loading}
            className="w-full h-11 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              "Remove Liquidity"
            )}
          </button>

          {/* Status Messages */}
          {status && (
            <p className="text-white/80 text-sm text-center">{status}</p>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Warning */}
          <div className="text-xs text-white/50 text-center">
            <p>⚠️ This action is irreversible. LP tokens will be burned.</p>
            <p>You will receive your proportional share of the pool.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
