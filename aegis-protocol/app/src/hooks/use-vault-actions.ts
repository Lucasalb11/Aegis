import { useCallback } from 'react';
import { useAegis } from '@/components/providers/aegis-provider';
import { PolicyConfig, SwapRequestParams, solToLamports, WSOL_MINT, USDC_MINT } from '@aegis/sdk';
import { toast } from 'sonner';

export const useVaultActions = () => {
  const { client, vault, refreshVault, refreshPendingActions } = useAegis();

  const createVault = useCallback(async (
    dailyLimit: string,
    largeThreshold: string,
    setLoading: (loading: boolean) => void
  ) => {
    if (!client) {
      toast.error('Client not initialized');
      return;
    }

    setLoading(true);
    try {
      const policyConfig: PolicyConfig = {
        dailySpendLimitLamports: solToLamports(parseFloat(dailyLimit)),
        largeTxThresholdLamports: solToLamports(parseFloat(largeThreshold)),
      };

      await client.createVault(policyConfig);
      await refreshVault();
      await refreshPendingActions();

      toast.success('Vault created successfully!');
    } catch (error: any) {
      console.error('Failed to create vault:', error);
      toast.error(`Failed to create vault: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [client, refreshVault, refreshPendingActions]);

  const depositSol = useCallback(async (
    amount: string,
    setLoading: (loading: boolean) => void
  ) => {
    if (!client || !vault) {
      toast.error('Client or vault not available');
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast.error('Invalid deposit amount');
      return;
    }

    setLoading(true);
    try {
      await client.depositSol(vault.owner, depositAmount);
      await refreshVault();

      toast.success(`${depositAmount} SOL deposited successfully!`);
    } catch (error: any) {
      console.error('Failed to deposit:', error);
      toast.error(`Failed to deposit SOL: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [client, vault, refreshVault]);

  const requestSmallSwap = useCallback(async (
    setLoading: (loading: boolean) => void
  ) => {
    if (!client || !vault) {
      toast.error('Client or vault not available');
      return;
    }

    setLoading(true);
    try {
      const swapAmount = 0.5; // Small swap: 0.5 SOL (below threshold)
      const swapParams: SwapRequestParams = {
        vaultPubkey: vault.owner,
        amount: solToLamports(swapAmount),
        fromMint: WSOL_MINT,
        toMint: USDC_MINT,
        amountOutMin: solToLamports(swapAmount * 0.9), // Min 90% of input value
      };

      await client.requestSwap(swapParams);
      await refreshVault();

      toast.success(`${swapAmount} SOL swap executed successfully!`);
    } catch (error: any) {
      console.error('Failed to execute swap:', error);
      toast.error(`Failed to execute swap: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [client, vault, refreshVault]);

  const requestLargeSwap = useCallback(async (
    setLoading: (loading: boolean) => void
  ) => {
    if (!client || !vault) {
      toast.error('Client or vault not available');
      return;
    }

    setLoading(true);
    try {
      const swapAmount = 1.5; // Large swap: 1.5 SOL (above threshold)
      const swapParams: SwapRequestParams = {
        vaultPubkey: vault.owner,
        amount: solToLamports(swapAmount),
        fromMint: WSOL_MINT,
        toMint: USDC_MINT,
        amountOutMin: solToLamports(swapAmount * 0.9), // Min 90% of input value
      };

      const result = await client.requestSwap(swapParams);
      await refreshVault();
      await refreshPendingActions();

      if (result.pendingAction) {
        toast.success(`Large ${swapAmount} SOL swap submitted for approval!`);
      } else {
        toast.success(`Large ${swapAmount} SOL swap executed!`);
      }
    } catch (error: any) {
      console.error('Failed to submit large swap:', error);
      toast.error(`Failed to submit large swap: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [client, vault, refreshVault, refreshPendingActions]);

  const approvePendingAction = useCallback(async (
    pendingActionPubkey: string,
    setLoading: (loading: (key: string | null) => void) => void
  ) => {
    if (!client) {
      toast.error('Client not initialized');
      return;
    }

    setLoading(pendingActionPubkey);
    try {
      await client.approvePendingAction(new PublicKey(pendingActionPubkey));
      await refreshVault();
      await refreshPendingActions();

      toast.success('Pending action approved and executed!');
    } catch (error: any) {
      console.error('Failed to approve action:', error);
      toast.error(`Failed to approve action: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  }, [client, refreshVault, refreshPendingActions]);

  return {
    createVault,
    depositSol,
    requestSmallSwap,
    requestLargeSwap,
    approvePendingAction,
  };
};
