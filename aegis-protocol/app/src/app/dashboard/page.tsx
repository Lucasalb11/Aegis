'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { VaultDashboard } from '@/components/vault-dashboard';
import { Shield, Activity, Settings, Wallet as WalletIcon } from 'lucide-react';

export default function Dashboard() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <Shield className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Aegis Protocol</h1>
                <p className="text-xs text-slate-400">AI Agent Vaults</p>
              </div>
            </div>
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !text-white !font-medium !rounded-lg !transition-all !duration-200 !shadow-lg hover:!shadow-purple-500/25" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!connected ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="p-4 bg-purple-600/10 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                <WalletIcon className="h-8 w-8 text-purple-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Connect your Solana wallet to start managing AI agent vaults with Aegis Protocol.
              </p>
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !text-white !font-medium !px-8 !py-3 !rounded-lg !transition-all !duration-200 !shadow-lg hover:!shadow-purple-500/25" />
            </div>
          </div>
        ) : (
          <VaultDashboard />
        )}
      </main>
    </div>
  );
}
