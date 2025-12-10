"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { TokenInfo } from "@/src/hooks/usePools";

interface TokenSelectorProps {
  tokens: TokenInfo[];
  selectedToken: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeToken?: PublicKey;
}

export function TokenSelector({
  tokens,
  selectedToken,
  onSelect,
  placeholder = "Select token",
  disabled = false,
  excludeToken,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const filteredTokens = tokens.filter(token =>
    !excludeToken || !token.mint.equals(excludeToken)
  );

  const handleSelect = (token: TokenInfo) => {
    onSelect(token);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-3">
          {selectedToken ? (
            <>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                {selectedToken.symbol.slice(0, 2)}
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">{selectedToken.symbol}</div>
                <div className="text-xs text-white/60">{selectedToken.name}</div>
              </div>
            </>
          ) : (
            <span className="text-white/60">{placeholder}</span>
          )}
        </div>
        <ChevronDownIcon className={`w-5 h-5 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/95 backdrop-blur-xl shadow-xl">
            {filteredTokens.length === 0 ? (
              <div className="p-4 text-center text-white/60">
                No tokens available
              </div>
            ) : (
              filteredTokens.map((token) => (
                <button
                  key={token.mint.toString()}
                  onClick={() => handleSelect(token)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{token.symbol}</div>
                    <div className="text-xs text-white/60">{token.name}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}