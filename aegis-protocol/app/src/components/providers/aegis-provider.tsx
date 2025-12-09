'use client';

import { FC, ReactNode, createContext, useContext, useMemo, useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { AegisClient, VaultInfo, PolicyInfo, PendingActionInfo } from '@aegis/sdk';
import { PublicKey } from '@solana/web3.js';

interface AegisContextType {
  client: AegisClient | null;
  vault: VaultInfo | null;
  policy: PolicyInfo | null;
  pendingActions: PendingActionInfo[];
  isLoading: boolean;
  refreshVault: () => Promise<void>;
  refreshPendingActions: () => Promise<void>;
}

const AegisContext = createContext<AegisContextType | undefined>(undefined);

// Aegis Program ID - should match your deployed program
const PROGRAM_ID = new PublicKey('41FsEq3HW76tijmW1GxLon4dP8x2Q8m7g9JQ6Y2BFpF1');

export const AegisProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [client, setClient] = useState<AegisClient | null>(null);
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [policy, setPolicy] = useState<PolicyInfo | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Aegis client when wallet is connected
  useEffect(() => {
    if (connection && publicKey && signTransaction && signAllTransactions) {
      try {
        const wallet = {
          publicKey,
          signTransaction,
          signAllTransactions,
        };

        const aegisClient = AegisClient.initAegisClient(
          connection,
          wallet as any,
          PROGRAM_ID
        );

        setClient(aegisClient);
      } catch (error) {
        console.error('Failed to initialize Aegis client:', error);
        setClient(null);
      }
    } else {
      setClient(null);
      setVault(null);
      setPolicy(null);
      setPendingActions([]);
    }
  }, [connection, publicKey, signTransaction, signAllTransactions]);

  // Load vault data when client is available
  useEffect(() => {
    if (client && publicKey) {
      refreshVault();
    }
  }, [client, publicKey]);

  // Refresh pending actions when vault becomes available
  useEffect(() => {
    if (client && vault) {
      refreshPendingActions();
    }
  }, [client, vault]);

  const refreshVault = async () => {
    if (!client || !publicKey) return;

    setIsLoading(true);
    try {
      // Derive vault PDA
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), publicKey.toBuffer()],
        PROGRAM_ID
      );

      const vaultData = await client.getVault(vaultPDA);
      const policyData = await client.getPolicy(vaultPDA);

      setVault(vaultData);
      setPolicy(policyData);
    } catch (error) {
      // Vault doesn't exist yet
      setVault(null);
      setPolicy(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPendingActions = async () => {
    if (!client || !vault) {
      setPendingActions([]);
      return;
    }

    try {
      // For now, use a mock implementation since full indexing isn't implemented
      // In production, this would query the actual pending actions
      const mockPendingActions = [
        // This would be populated from actual blockchain data
        // For demo purposes, we'll start with empty array
      ];

      setPendingActions(mockPendingActions);
    } catch (error) {
      console.error('Failed to load pending actions:', error);
      setPendingActions([]);
    }
  };

  const value = useMemo(
    () => ({
      client,
      vault,
      policy,
      pendingActions,
      isLoading,
      refreshVault,
      refreshPendingActions,
    }),
    [client, vault, policy, pendingActions, isLoading]
  );

  return <AegisContext.Provider value={value}>{children}</AegisContext.Provider>;
};

export const useAegis = () => {
  const context = useContext(AegisContext);
  if (context === undefined) {
    throw new Error('useAegis must be used within an AegisProvider');
  }
  return context;
};
