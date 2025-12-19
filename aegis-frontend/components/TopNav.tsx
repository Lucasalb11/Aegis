 "use client";

import Link from "next/link";
import { useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const navLinks = [
  { href: "/swap", label: "Swap" },
  { href: "/pools", label: "Pools" },
  { href: "/faucet", label: "Faucet" },
  { href: "/analytics", label: "Analytics" },
];

export function TopNav({ active }: { active?: string }) {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const label = useMemo(() => {
    if (connecting) return "Connecting...";
    if (connected && publicKey) {
      const base58 = publicKey.toBase58();
      return `${base58.slice(0, 4)}...${base58.slice(-4)}`;
    }
    return "Connect Wallet";
  }, [connected, connecting, publicKey]);

  const handleClick = useCallback(() => {
    if (connected) {
      void disconnect();
    } else {
      setVisible(true);
    }
  }, [connected, disconnect, setVisible]);

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4 lg:px-10">
      <div className="flex items-center gap-3 text-white">
        <div className="size-8 text-primary">
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path
              clipRule="evenodd"
              d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z"
              fill="currentColor"
              fillRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold tracking-tight">Aegis Protocol</h2>
      </div>

      <nav className="flex flex-1 justify-center gap-6 text-sm font-medium">
        {navLinks.map((link) => {
          const isActive = active === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative transition-colors ${
                isActive ? "text-white" : "text-white/70 hover:text-white"
              }`}
            >
              {link.label}
              {isActive && (
                <span className="absolute -bottom-3 left-0 h-0.5 w-full bg-accent-orange" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex justify-end min-w-[200px]">
        <button
          onClick={handleClick}
          className="flex items-center justify-center h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-60"
          disabled={connecting}
        >
          {label}
        </button>
      </div>
    </header>
  );
}
