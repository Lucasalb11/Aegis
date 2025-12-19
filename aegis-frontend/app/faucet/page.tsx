"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { TopNav } from "@/components/TopNav";
import { useWallet } from "@solana/wallet-adapter-react";

// Token configuration from mints.json
const AVAILABLE_TOKENS = [
  {
    symbol: "AEGIS",
    name: "Aegis Token",
    mint: "GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9",
    decimals: 6,
    icon: "https://lh3.googleusercontent.com/aida-public/AB6AXuAOc2v63wG7G_vjriVQDPKbl7GcaOeGugQjhP8XT1sFfVW8IfMfB1yWMRRAXNRMOeUsJP_-31PoYUzTqUY0NuZrff-G8j-5vxc-pds83pc--J7NrJJcBWxVTDjl0Edg6ElQRDnApc4Sji6B-46nn_WFo_mdrZBq8lp1jzklSZT6AK20QIuDn4ojmefNJWVkAKP9B7Ib0GNUJRv5nS_gbCivNBtV4PnWpNeodiQkGenvtgnJGdf3xUBJyiyuw7vnWNJRhlk3KKzNvn1L",
  },
  {
    symbol: "AERO",
    name: "Aero Token",
    mint: "DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3",
    decimals: 6,
    icon: "https://assets.coingecko.com/coins/images/17752/small/mSOL.png?1696516777",
  },
  {
    symbol: "ABTC",
    name: "Aegis Bitcoin",
    mint: "3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc",
    decimals: 6,
    icon: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg?1696528245",
  },
  {
    symbol: "AUSD",
    name: "Aegis USD",
    mint: "D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys",
    decimals: 6,
    icon: "https://lh3.googleusercontent.com/aida-public/AB6AXuAykMhiUJhX_Q_0jS-jnKFU-knoD1oau_n2p2Ru_xQDpK1kPTWnYPZOKImrwQEAm_4aJeuLM4wsaI7X2nxCoTAWtoBY_gTKvOSe07nl4KEuCPr6kRml2G9wNhtMdA4FfidRYKxWy99Vh0nMeI59vq6EmIiI8R2iSU-GhRt1cVySx0xdNpfoVNXsY9AbODho7szpVt1CIxYIdL0mSqQn-nX1JtMhpLei1TOloY7gMDHjmbmWapt9WsQXT1Z4gYIt4PX7C_B1rdxSaB70",
  },
  {
    symbol: "ASOL",
    name: "Aegis SOL",
    mint: "7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15",
    decimals: 6,
    icon: "https://assets.coingecko.com/coins/images/17752/small/mSOL.png?1696516777",
  },
];

const TOKENS_PER_REQUEST = 10;
const COOLDOWN_HOURS = 24;

interface FaucetStatus {
  canClaim: boolean;
  nextClaimTime?: Date;
  lastClaim?: Date;
  message?: string;
}

export default function FaucetPage() {
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faucetStatus, setFaucetStatus] = useState<FaucetStatus | null>(null);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(
    new Set(AVAILABLE_TOKENS.map(t => t.symbol))
  );

  // Check faucet status when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      checkFaucetStatus();
    } else {
      setFaucetStatus(null);
    }
  }, [connected, publicKey]);

  const checkFaucetStatus = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/faucet/status?wallet=${publicKey.toString()}`);
      const data = await response.json();
      
      setFaucetStatus({
        canClaim: data.canClaim,
        nextClaimTime: data.nextClaimTime ? new Date(data.nextClaimTime) : undefined,
        lastClaim: data.lastClaim ? new Date(data.lastClaim) : undefined,
        message: data.message,
      });
    } catch (err) {
      console.error('[Faucet] Failed to check status:', err);
      // Default to allowing claim if API fails
      setFaucetStatus({ canClaim: true });
    }
  };

  const toggleToken = (symbol: string) => {
    const newSelected = new Set(selectedTokens);
    if (newSelected.has(symbol)) {
      newSelected.delete(symbol);
    } else {
      newSelected.add(symbol);
    }
    setSelectedTokens(newSelected);
  };

  const selectAll = () => {
    setSelectedTokens(new Set(AVAILABLE_TOKENS.map(t => t.symbol)));
  };

  const deselectAll = () => {
    setSelectedTokens(new Set());
  };

  const handleClaim = async () => {
    if (!connected || !publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    if (selectedTokens.size === 0) {
      setError("Please select at least one token");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("Requesting tokens from faucet...");

    try {
      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          tokens: Array.from(selectedTokens),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to claim tokens");
      }

      setStatus(`Success! You received ${TOKENS_PER_REQUEST} of each selected token. Tx: ${data.signatures?.join(', ').slice(0, 20)}...`);
      
      // Refresh faucet status
      await checkFaucetStatus();
    } catch (err: any) {
      console.error('[Faucet] Claim error:', err);
      setError(err.message || "Failed to claim tokens");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeUntilClaim = () => {
    if (!faucetStatus?.nextClaimTime) return null;
    
    const now = new Date();
    const diff = faucetStatus.nextClaimTime.getTime() - now.getTime();
    
    if (diff <= 0) return "Available now!";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav active="/faucet" />
      
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.08em] text-white/60">Devnet</p>
          <h1 className="text-3xl font-black tracking-tight">Token Faucet</h1>
          <p className="text-white/60 text-sm">
            Get free Aegis test tokens for development and testing on Solana devnet
          </p>
        </div>

        {/* Faucet Info Card */}
        <div className="card-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-2xl">💧</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Aegis Test Tokens</h2>
              <p className="text-white/60 text-sm">
                {TOKENS_PER_REQUEST} tokens per request • {COOLDOWN_HOURS}h cooldown
              </p>
            </div>
          </div>

          {/* Connection Status */}
          {!connected && (
            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20 mb-4">
              <p className="text-yellow-400 text-sm">
                Connect your Phantom wallet to claim tokens
              </p>
            </div>
          )}

          {/* Claim Status */}
          {connected && faucetStatus && !faucetStatus.canClaim && (
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 mb-4">
              <p className="text-blue-400 text-sm">
                ⏳ Next claim available in: {formatTimeUntilClaim()}
              </p>
              {faucetStatus.lastClaim && (
                <p className="text-blue-300/60 text-xs mt-1">
                  Last claimed: {faucetStatus.lastClaim.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {connected && faucetStatus?.canClaim && (
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 mb-4">
              <p className="text-green-400 text-sm">
                ✅ You can claim tokens now!
              </p>
            </div>
          )}
        </div>

        {/* Token Selection */}
        <div className="card-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Select Tokens</h3>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Select All
              </button>
              <span className="text-white/30">|</span>
              <button
                onClick={deselectAll}
                className="text-xs text-white/60 hover:text-white/80 transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AVAILABLE_TOKENS.map((token) => (
              <button
                key={token.symbol}
                onClick={() => toggleToken(token.symbol)}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                  selectedTokens.has(token.symbol)
                    ? "bg-primary/20 border-primary"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <img
                  src={token.icon}
                  alt={token.symbol}
                  className="w-10 h-10 rounded-full"
                />
                <div className="text-left flex-1">
                  <p className="font-semibold text-white">{token.symbol}</p>
                  <p className="text-xs text-white/60">{token.name}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedTokens.has(token.symbol)
                    ? "border-primary bg-primary"
                    : "border-white/30"
                }`}>
                  {selectedTokens.has(token.symbol) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 text-center text-white/60 text-sm">
            You will receive <span className="text-white font-semibold">{TOKENS_PER_REQUEST}</span> of each selected token
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={handleClaim}
          disabled={
            !connected ||
            loading ||
            selectedTokens.size === 0 ||
            faucetStatus?.canClaim === false
          }
          className="h-14 px-6 rounded-lg bg-primary text-white text-lg font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Claiming...
            </span>
          ) : !connected ? (
            "Connect Wallet to Claim"
          ) : faucetStatus && !faucetStatus.canClaim ? (
            `Wait ${formatTimeUntilClaim()}`
          ) : (
            `Claim ${selectedTokens.size} Token${selectedTokens.size !== 1 ? 's' : ''}`
          )}
        </button>

        {/* Status Messages */}
        {status && (
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-green-400 text-sm">{status}</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Info Section */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p className="font-semibold text-white mb-2">About the Faucet</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Get {TOKENS_PER_REQUEST} tokens of each selected type per request</li>
            <li>{COOLDOWN_HOURS}-hour cooldown between claims</li>
            <li>Tokens are for testing on Solana devnet only</li>
            <li>Use these tokens to test swaps and liquidity pools</li>
            <li>Make sure you have some SOL for transaction fees</li>
          </ul>
        </div>

        {/* Token Addresses */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="font-semibold text-white mb-3 text-sm">Token Mint Addresses</p>
          <div className="space-y-2">
            {AVAILABLE_TOKENS.map((token) => (
              <div key={token.mint} className="flex items-center justify-between text-xs">
                <span className="text-white/60">{token.symbol}</span>
                <code className="text-white/40 font-mono">
                  {token.mint.slice(0, 8)}...{token.mint.slice(-8)}
                </code>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
