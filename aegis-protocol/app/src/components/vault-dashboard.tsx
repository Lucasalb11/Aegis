'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAegis } from '@/components/providers/aegis-provider';
import { useVaultActions } from '@/hooks/use-vault-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Wallet, TrendingUp, Clock, CheckCircle, XCircle, Bot, Zap, Shield, Activity } from 'lucide-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

interface AgentLogEntry {
  id: string;
  timestamp: Date;
  type: 'request' | 'policy_check' | 'execution' | 'approval' | 'deposit';
  message: string;
  status?: 'success' | 'pending' | 'error';
}

export function VaultDashboard() {
  const { publicKey } = useWallet();
  const { vault, policy, pendingActions, isLoading } = useAegis();
  const {
    createVault,
    depositSol,
    requestSmallSwap,
    requestLargeSwap,
    approvePendingAction
  } = useVaultActions();

  // Form states
  const [dailyLimit, setDailyLimit] = useState('10');
  const [largeThreshold, setLargeThreshold] = useState('2');
  const [depositAmount, setDepositAmount] = useState('1');

  // Loading states
  const [isCreatingVault, setIsCreatingVault] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [approvingAction, setApprovingAction] = useState<string | null>(null);

  // Agent activity log
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);

  // Add log entry function
  const addLogEntry = (type: AgentLogEntry['type'], message: string, status?: AgentLogEntry['status']) => {
    const newEntry: AgentLogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      message,
      status
    };
    setAgentLogs(prev => [newEntry, ...prev.slice(0, 19)]); // Keep last 20 entries
  };

  // Initialize with some demo logs
  useEffect(() => {
    if (vault) {
      addLogEntry('request', 'AI Agent initialized and connected to vault', 'success');
    }
  }, [vault]);

  const handleCreateVault = async () => {
    addLogEntry('request', `Creating vault with ${dailyLimit} SOL daily limit and ${largeThreshold} SOL threshold`, 'pending');
    const success = await createVault(dailyLimit, largeThreshold, setIsCreatingVault);
    if (success !== false) { // Assuming success if not explicitly false
      addLogEntry('execution', 'Vault created successfully with policy enforcement', 'success');
    }
  };

  const handleDeposit = async () => {
    addLogEntry('deposit', `Depositing ${depositAmount} SOL to vault`, 'pending');
    const success = await depositSol(depositAmount, setIsDepositing);
    if (success !== false) {
      addLogEntry('deposit', `${depositAmount} SOL deposited successfully`, 'success');
    }
  };

  const handleSmallSwap = async () => {
    addLogEntry('request', 'AI Agent requested small swap: 0.5 SOL → USDC', 'pending');
    addLogEntry('policy_check', 'Policy validation: Amount below threshold, auto-approval', 'success');
    const success = await requestSmallSwap(setIsSwapping);
    if (success !== false) {
      addLogEntry('execution', 'Small swap executed immediately via Jupiter', 'success');
    }
  };

  const handleLargeSwap = async () => {
    addLogEntry('request', 'AI Agent requested large swap: 1.5 SOL → USDC', 'pending');
    addLogEntry('policy_check', 'Policy validation: Amount above threshold, requires approval', 'pending');
    const success = await requestLargeSwap(setIsSwapping);
    if (success !== false) {
      addLogEntry('execution', 'Large swap submitted for human approval', 'success');
    }
  };

  const handleApproveAction = async (pendingActionPubkey: string) => {
    addLogEntry('approval', 'Human approved pending large transaction', 'pending');
    const success = await approvePendingAction(pendingActionPubkey, setApprovingAction);
    if (success !== false) {
      addLogEntry('execution', 'Large swap executed after approval', 'success');
    }
  };

  if (!publicKey) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Please connect your wallet to continue.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[600px]">
      {/* Main Content Area */}
      <div className="lg:col-span-3 space-y-6">
        {/* Vault Creation Section */}
        {!vault && (
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-purple-600/20 rounded-lg">
                  <Plus className="h-5 w-5 text-purple-400" />
                </div>
                Create Your Vault
              </CardTitle>
              <CardDescription className="text-slate-400">
                Set up your first Aegis vault with spending policies for AI agent management.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="dailyLimit" className="text-sm font-medium text-slate-300">
                    Daily Spend Limit (SOL)
                  </Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    placeholder="10"
                    className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="largeThreshold" className="text-sm font-medium text-slate-300">
                    Large Tx Threshold (SOL)
                  </Label>
                  <Input
                    id="largeThreshold"
                    type="number"
                    value={largeThreshold}
                    onChange={(e) => setLargeThreshold(e.target.value)}
                    placeholder="2"
                    className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-200"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateVault}
                disabled={isCreatingVault}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingVault && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Vault
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Vault Dashboard */}
        {vault && (
          <>
            {/* Vault Summary */}
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <Wallet className="h-5 w-5 text-purple-400" />
                  </div>
                  Vault Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Balance</p>
                    <p className="text-2xl font-bold text-green-400">
                      {(vault.balance.toNumber() / LAMPORTS_PER_SOL).toFixed(3)}
                      <span className="text-sm text-slate-400 ml-1">SOL</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Daily Spent</p>
                    <p className="text-lg font-semibold text-slate-300">
                      {(vault.dailySpent.toNumber() / LAMPORTS_PER_SOL).toFixed(3)} /
                      <span className="text-slate-400"> {(policy?.dailySpendLimitLamports.toNumber() || 0) / LAMPORTS_PER_SOL}</span>
                      <span className="text-sm text-slate-400 ml-1">SOL</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</p>
                    <Badge variant={vault.isActive ? "default" : "secondary"} className="text-xs">
                      {vault.isActive ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                      )}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending</p>
                    <p className="text-lg font-semibold text-orange-400">{pendingActions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Deposit SOL */}
              <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-green-600/20 rounded-lg">
                      <Wallet className="h-4 w-4 text-green-400" />
                    </div>
                    Deposit SOL
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Add funds to your vault for AI agent operations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="depositAmount" className="text-sm font-medium text-slate-300">
                      Amount (SOL)
                    </Label>
                    <Input
                      id="depositAmount"
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="1.0"
                      className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-green-500/20 transition-all duration-200"
                    />
                  </div>
                  <Button
                    onClick={handleDeposit}
                    disabled={isDepositing}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDepositing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Deposit SOL
                  </Button>
                </CardContent>
              </Card>

              {/* Simulate AI Swaps */}
              <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/20 rounded-lg">
                      <Bot className="h-4 w-4 text-blue-400" />
                    </div>
                    AI Agent Actions
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Simulate AI agent trading with policy enforcement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Button
                      onClick={handleSmallSwap}
                      disabled={isSwapping}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSwapping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Zap className="w-4 h-4 mr-2" />
                      Small Swap (0.5 SOL)
                    </Button>
                    <Button
                      onClick={handleLargeSwap}
                      disabled={isSwapping}
                      variant="outline"
                      className="w-full border-orange-600/50 text-orange-400 hover:bg-orange-600 hover:text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSwapping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Shield className="w-4 h-4 mr-2" />
                      Large Swap (1.5 SOL)
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500 bg-slate-700/30 rounded-lg p-3">
                    <strong>Small:</strong> Auto-executes • <strong>Large:</strong> Requires approval
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pending Actions */}
            {pendingActions.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-orange-600/20 rounded-lg">
                      <Clock className="h-4 w-4 text-orange-400" />
                    </div>
                    Pending Actions
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Large transactions awaiting your approval.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingActions.map((action, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600/50 hover:bg-slate-700/50 transition-all duration-200">
                        <div className="space-y-1">
                          <p className="font-medium text-white">
                            {(action.amountLamports.toNumber() / LAMPORTS_PER_SOL).toFixed(3)} SOL Swap
                          </p>
                          <p className="text-sm text-slate-400">
                            {new Date(action.requestedAt.toNumber() * 1000).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">
                            Pending
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => handleApproveAction(action.owner.toString())}
                            disabled={approvingAction === action.owner.toString()}
                            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {approvingAction === action.owner.toString() && (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            )}
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3 bg-slate-800/50 rounded-lg px-6 py-4 border border-slate-700/50">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              <span className="text-slate-300">Loading vault data...</span>
            </div>
          </div>
        )}
      </div>

      {/* Agent Activity Sidebar */}
      <div className="lg:col-span-1">
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-xl sticky top-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-cyan-600/20 rounded-lg">
                <Activity className="h-4 w-4 text-cyan-400" />
              </div>
              Agent Activity
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Real-time AI agent activity log
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto space-y-1 px-6 pb-6">
              {agentLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activity yet</p>
                </div>
              ) : (
                agentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start space-x-3 p-3 rounded-lg bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50 transition-all duration-200"
                  >
                    <div className={`p-1 rounded-full ${
                      log.type === 'request' ? 'bg-blue-600/20' :
                      log.type === 'policy_check' ? 'bg-purple-600/20' :
                      log.type === 'execution' ? 'bg-green-600/20' :
                      log.type === 'approval' ? 'bg-orange-600/20' :
                      'bg-slate-600/20'
                    }`}>
                      {log.type === 'request' && <Bot className="h-3 w-3 text-blue-400" />}
                      {log.type === 'policy_check' && <Shield className="h-3 w-3 text-purple-400" />}
                      {log.type === 'execution' && <CheckCircle className="h-3 w-3 text-green-400" />}
                      {log.type === 'approval' && <Clock className="h-3 w-3 text-orange-400" />}
                      {log.type === 'deposit' && <Wallet className="h-3 w-3 text-cyan-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 leading-tight">{log.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {log.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {log.status && (
                      <div className={`px-2 py-1 rounded-full text-xs ${
                        log.status === 'success' ? 'bg-green-600/20 text-green-400' :
                        log.status === 'pending' ? 'bg-yellow-600/20 text-yellow-400' :
                        'bg-red-600/20 text-red-400'
                      }`}>
                        {log.status}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
