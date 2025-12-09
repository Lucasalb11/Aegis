import Link from 'next/link';
import { Shield, Zap, Lock, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-purple-400" />
            <span className="text-2xl font-bold text-white">Aegis Protocol</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Launch App
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            AI Agent Vaults with
            <span className="text-purple-400"> Programmable Safety</span>
          </h1>

          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Aegis creates smart vaults (PDAs) with spending policies so AI agents can manage funds
            while respecting on-chain guardrails. Think of it as a programmable safety net for autonomous financial agents.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/dashboard"
              className="inline-flex items-center px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-lg transition-colors"
            >
              Launch App
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
              <Lock className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Policy Enforcement</h3>
              <p className="text-gray-400">
                Set daily spending limits and transaction size thresholds to control AI agent behavior.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
              <Zap className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Instant Execution</h3>
              <p className="text-gray-400">
                Small transactions execute immediately. Large ones require approval for enhanced security.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
              <Shield className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Human Oversight</h3>
              <p className="text-gray-400">
                Critical transactions need human approval while maintaining AI autonomy for routine operations.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t border-slate-800">
        <div className="text-center text-gray-400">
          <p>&copy; 2024 Aegis Protocol. Built for secure AI agent fund management on Solana.</p>
        </div>
      </footer>
    </div>
  );
}
