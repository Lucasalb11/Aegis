"use client";

export const dynamic = 'force-dynamic';

import { TopNav } from "@/components/TopNav";
import { useAnalytics } from "@/src/hooks/useAnalytics";
import { useAegis } from "@/src/providers/AegisProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

export default function AnalyticsPage() {
  const { programId } = useAegis();
  const { connected } = useWallet();
  const { analytics, loading, error } = useAnalytics(programId || undefined);

  const chartData = useMemo(() => {
    if (!analytics) return null;
    
    return analytics.balanceHistory.map(snapshot => ({
      date: new Date(snapshot.timestamp).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
      value: snapshot.totalUsd,
    }));
  }, [analytics]);

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav active="/analytics" />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="card-surface p-6 text-center">
            <p className="text-white/60">Conecte sua carteira para ver suas estatísticas</p>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav active="/analytics" />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="card-surface p-6 text-center">
            <p className="text-white/60">Carregando estatísticas...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav active="/analytics" />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="card-surface p-6 text-center">
            <p className="text-red-400">Erro ao carregar estatísticas: {error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav active="/analytics" />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="card-surface p-6 text-center">
            <p className="text-white/60">Nenhum dado disponível</p>
          </div>
        </main>
      </div>
    );
  }

  const maxValue = Math.max(...analytics.balanceHistory.map(s => s.totalUsd));
  const minValue = Math.min(...analytics.balanceHistory.map(s => s.totalUsd));
  const chartHeight = 200;

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav active="/analytics" />
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.08em] text-white/60">Analytics</p>
          <h1 className="text-3xl font-black tracking-tight">Estatísticas e Performance</h1>
          <p className="text-white/60 text-sm">
            Acompanhe a evolução do seu saldo, taxas recolhidas e PnL
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-surface p-6">
            <p className="text-sm text-white/60 mb-2">Saldo Total</p>
            <p className="text-2xl font-bold text-white">
              ${analytics.balanceHistory[analytics.balanceHistory.length - 1]?.totalUsd.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) || '0.00'}
            </p>
          </div>

          <div className="card-surface p-6">
            <p className="text-sm text-white/60 mb-2">PnL Total</p>
            <p className={`text-2xl font-bold ${analytics.pnl.totalPnLUsd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {analytics.pnl.totalPnLUsd >= 0 ? '+' : ''}
              ${analytics.pnl.totalPnLUsd.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className={`text-sm mt-1 ${analytics.pnl.pnLPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {analytics.pnl.pnLPercentage >= 0 ? '+' : ''}
              {analytics.pnl.pnLPercentage.toFixed(2)}%
            </p>
          </div>

          <div className="card-surface p-6">
            <p className="text-sm text-white/60 mb-2">Taxas Recolhidas</p>
            <p className="text-2xl font-bold text-white">
              ${analytics.fees.totalFeesUsd.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-sm text-white/60 mt-1">
              ${analytics.fees.fees24hUsd.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} nas últimas 24h
            </p>
          </div>

          <div className="card-surface p-6">
            <p className="text-sm text-white/60 mb-2">Pools Ativos</p>
            <p className="text-2xl font-bold text-white">{analytics.activePools}</p>
            <p className="text-sm text-white/60 mt-1">
              ${analytics.totalLiquidityProvided.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} em liquidez
            </p>
          </div>
        </div>

        {/* Balance Evolution Chart */}
        <div className="card-surface p-6">
          <h2 className="text-xl font-bold text-white mb-4">Evolução do Saldo</h2>
          <div className="relative" style={{ height: `${chartHeight + 40}px` }}>
            <svg width="100%" height={chartHeight + 40} className="overflow-visible">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = chartHeight - ratio * chartHeight + 20;
                const value = minValue + (maxValue - minValue) * ratio;
                return (
                  <g key={ratio}>
                    <line
                      x1="0"
                      y1={y}
                      x2="100%"
                      y2={y}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y={y + 4}
                      fill="rgba(255,255,255,0.6)"
                      fontSize="12"
                      className="font-mono"
                    >
                      ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </text>
                  </g>
                );
              })}

              {/* Chart line */}
              {chartData && chartData.length > 1 && (
                <polyline
                  points={chartData
                    .map((point, idx) => {
                      const x = (idx / (chartData.length - 1)) * 100;
                      const y = chartHeight - ((point.value - minValue) / (maxValue - minValue)) * chartHeight + 20;
                      return `${x}%,${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="rgb(255, 140, 0)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Chart area fill */}
              {chartData && chartData.length > 1 && (
                <polygon
                  points={`0%,${chartHeight + 20} ${chartData
                    .map((point, idx) => {
                      const x = (idx / (chartData.length - 1)) * 100;
                      const y = chartHeight - ((point.value - minValue) / (maxValue - minValue)) * chartHeight + 20;
                      return `${x}%,${y}`;
                    })
                    .join(' ')} 100%,${chartHeight + 20}`}
                  fill="rgba(255, 140, 0, 0.1)"
                />
              )}
            </svg>
          </div>
        </div>

        {/* PnL by Pool */}
        <div className="card-surface p-6">
          <h2 className="text-xl font-bold text-white mb-4">PnL por Pool</h2>
          <div className="space-y-3">
            {analytics.pnl.pnLByPool.length === 0 ? (
              <p className="text-white/60 text-sm">Nenhuma posição ativa</p>
            ) : (
              analytics.pnl.pnLByPool.map((poolPnL) => (
                <div
                  key={poolPnL.pool}
                  className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5"
                >
                  <div>
                    <p className="font-semibold text-white">{poolPnL.pool}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        poolPnL.pnLUsd >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {poolPnL.pnLUsd >= 0 ? '+' : ''}
                      ${poolPnL.pnLUsd.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p
                      className={`text-sm ${
                        poolPnL.pnLPercentage >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {poolPnL.pnLPercentage >= 0 ? '+' : ''}
                      {poolPnL.pnLPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fees Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-surface p-6">
            <h2 className="text-xl font-bold text-white mb-4">Taxas Recolhidas</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Últimas 24h</span>
                <span className="font-semibold text-white">
                  ${analytics.fees.fees24hUsd.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Últimos 7 dias</span>
                <span className="font-semibold text-white">
                  ${analytics.fees.fees7dUsd.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Últimos 30 dias</span>
                <span className="font-semibold text-white">
                  ${analytics.fees.fees30dUsd.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">
                    ${analytics.fees.totalFeesUsd.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="text-xl font-bold text-white mb-4">Taxas por Pool</h2>
            <div className="space-y-3">
              {analytics.fees.feesByPool.length === 0 ? (
                <p className="text-white/60 text-sm">Nenhuma taxa recolhida</p>
              ) : (
                analytics.fees.feesByPool.map((fee) => (
                  <div
                    key={fee.pool}
                    className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
                  >
                    <span className="text-white/80">{fee.pool}</span>
                    <span className="font-semibold text-white">
                      ${fee.feesUsd.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="card-surface p-6">
          <h2 className="text-xl font-bold text-white mb-4">Estatísticas Adicionais</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-white/60 mb-1">Total de Swaps</p>
              <p className="text-lg font-semibold text-white">{analytics.totalSwaps}</p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Investimento Inicial</p>
              <p className="text-lg font-semibold text-white">
                ${analytics.pnl.initialInvestmentUsd.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Valor Atual</p>
              <p className="text-lg font-semibold text-white">
                ${analytics.pnl.currentValueUsd.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
