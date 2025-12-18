"use client";

import { AegisClient } from "@aegis/sdk";
import { Wallet } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import React, { createContext, useContext, useMemo } from "react";

type AegisContextValue = {
  aegisClient: AegisClient | null;
  programId: PublicKey | null;
};

const AegisContext = createContext<AegisContextValue>({
  aegisClient: null,
  programId: null,
});

function buildAnchorWallet(wallet: ReturnType<typeof useWallet>): Wallet | null {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    return null;
  }

  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
    // Anchor Wallet interface expects a payer Signer, but web wallets do not expose it.
    // We provide a placeholder to satisfy the type without leaking private keys.
    payer: undefined as any,
  } as Wallet;
}

export function AegisProvider({
  programId: programIdString,
  children,
}: {
  programId: string | undefined;
  children: React.ReactNode;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const value = useMemo(() => {
    try {
      if (!programIdString) return { aegisClient: null, programId: null };
      const programId = new PublicKey(programIdString);
      const anchorWallet = buildAnchorWallet(wallet);
      if (!anchorWallet) return { aegisClient: null, programId };

      // Verificar se a wallet está realmente conectada antes de criar o client
      if (!wallet.connected) {
        return { aegisClient: null, programId };
      }

      const aegisClient = AegisClient.initAegisClient(connection, anchorWallet, programId);
      return { aegisClient, programId };
    } catch (error) {
      console.error("Failed to initialize Aegis client:", error);
      return { aegisClient: null, programId: null };
    }
  }, [connection, wallet, programIdString]);

  return (
    <AegisContext.Provider value={value}>
      {children}
    </AegisContext.Provider>
  );
}

export function useAegis() {
  const context = useContext(AegisContext);
  if (!context) {
    console.warn("[useAegis] Hook called outside AegisProvider. Returning default values.");
    return {
      aegisClient: null,
      programId: null,
    };
  }
  return context;
}