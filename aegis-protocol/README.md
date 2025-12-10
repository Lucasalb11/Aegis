# Aegis Protocol 🛡️

**On-chain Safety Layer for AI Agents on Solana**

> **Solana Hackathon Submission** - Empowering AI with Secure DeFi Access

Aegis Protocol enables AI agents to autonomously manage crypto portfolios while enforcing programmable safety guardrails on Solana. It's the missing piece that makes AI-powered DeFi safe, reliable, and production-ready.

[![Built with Anchor](https://img.shields.io/badge/Built%20with-Anchor-blue)](https://www.anchor-lang.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-9945FF?logo=solana&logoColor=white)](https://solana.com/)

## 🎯 The Problem

**AI agents can revolutionize DeFi**, but they face an impossible security tradeoff:

**🤖 Maximum Autonomy** → Execute trades 24/7, capture opportunities instantly, optimize yields continuously.

**🛡️ Maximum Security** → Every transaction requires human approval, killing automation benefits.

**💥 Current Reality**: Most AI agents either have dangerous unrestricted access or crippling manual bottlenecks.

## 💡 The Solution

**Aegis Protocol**: Programmable on-chain vaults that give AI agents autonomy within safe boundaries.

### 🛡️ Safety Features
- **💰 Daily Spending Limits** - Automatic 24-hour reset
- **🔒 Protocol Whitelists** - Only approved DEXs (Jupiter MVP)
- **⚡ Smart Approvals** - Small trades auto-execute, large ones need approval
- **📊 On-Chain Enforcement** - Rules cannot be bypassed

### 🤖 AI Benefits
- **🚀 True Autonomy** within policy bounds
- **⚡ Instant Execution** for routine operations
- **🛡️ Human Oversight** only for critical decisions
- **📈 Risk Management** without sacrificing opportunity

## 🏗️ Architecture

Aegis Protocol consists of three main components working together to provide secure AI agent fund management:

### 📦 Core Components

- **🏦 Smart Vaults (PDAs)** - Gas-efficient on-chain fund storage with policy enforcement
- **📋 Policy Engine** - On-chain validation of spending rules and protocol restrictions
- **⏳ Pending Actions** - Human approval workflow for large transactions
- **🔗 Jupiter Integration** - Direct cross-program calls for seamless DEX execution

### 🔄 System Flow

```
Human Owner → Configure Policies → Deploy Vault PDA
      ↓
AI Agent → Request Transaction → Policy Validation
      ↓
Small Tx: Auto-Execute → Jupiter CPI → Complete
Large Tx: Create Pending → Human Approval → Execute
```

See [detailed architecture →](docs/architecture.md) for technical implementation details.

## 📁 Project Structure

```
aegis-protocol/
├── program/           # Anchor Solana Program
│   ├── src/
│   │   ├── lib.rs     # Main program logic
│   │   ├── state.rs   # Account structures
│   │   └── instructions/ # Instruction handlers
│   ├── tests/         # Program tests
│   └── idl/          # Generated interface
├── sdk/              # TypeScript SDK
│   ├── src/
│   │   ├── index.ts   # Main SDK exports
│   │   └── types.ts   # Type definitions
│   ├── scripts/       # Example scripts
│   └── target/        # Generated types
├── app/              # (removed: focusing on on-chain program first)
├── docs/             # Documentation
│   └── architecture.md # Technical details
└── README.md         # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js ≥18.0.0
- pnpm ≥8.0.0
- Solana CLI + Anchor CLI ≥0.30.0
- Phantom/Solflare wallet

### ⚡ 5-Minute Setup (devnet)

Environment (devnet):
```
# .secrets/devnet/ contains wallet keypairs
# Program ID: AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu
```

```bash
# Clone & install
git clone <your-repo-url>
cd aegis-protocol && pnpm install

# Build program
cd program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Build SDK
cd ../sdk && npm run build

# Install frontend dependencies
cd ../app && npm install

# Start frontend
npm run dev --port 3000
```

### 🏗️ Deploy Scripts

Para deploy automatizado, use os scripts preparados:

```bash
# Deploy program to devnet
cd program && npm run deploy:devnet

# Build and publish SDK
cd ../sdk && npm run build && npm publish

# Deploy frontend to Vercel/Netlify
cd ../app && npm run build && npm run deploy
```

## 🎯 Hackathon Demo (5 Minutes)

**Perfect for judges - shows the complete Aegis workflow!**

### Setup (1 min)
```bash
solana-test-validator                                    # Terminal 1 (optional, for local)
cd program && anchor build && anchor deploy --provider.cluster devnet  # Terminal 2
cd ../aegis-frontend && pnpm dev --port 3000             # Terminal 3 (UI)
```

### Demo Script

> UI pronta em `aegis-frontend` (Next.js). Use o fluxo completo: criar vault, depositar SOL, pedir swap (pequeno → executa; grande → pending), aprovar pending.

### 🎉 Demo Highlights
- **🔓 AI Freedom**: Small trades execute instantly within policies
- **🛡️ Human Control**: Large trades require approval
- **⛓️ On-Chain**: All rules enforced by Solana program
- **⚡ Real-Time**: Live balance updates and transaction feedback

## 🎯 Key Features

- **🏦 Smart Vaults**: Gas-efficient PDAs with policy-bound fund management
- **📋 Policy Engine**: Daily limits, protocol whitelists, size thresholds
- **🤖 AI Autonomy**: Execute within bounds, approval for large transactions
- **⏳ Pending Actions**: Human oversight workflow with time-sensitive approvals
- **🔗 Jupiter Integration**: Direct CPI calls for seamless DEX execution

## 🛡️ Security Guarantees

- **On-chain enforcement** - Rules cannot be bypassed
- **No off-chain dependencies** - Pure blockchain validation
- **Time-locked operations** - Approval windows for security
- **Emergency controls** - Owner can pause operations

## 🔧 Integration

### AI Agent Example
```typescript
import { AegisClient } from '@aegis/sdk';

const aegis = AegisClient.initAegisClient(connection, wallet, PROGRAM_ID);

// Create secure vault
const { vault } = await aegis.createVault({
  dailySpendLimitLamports: solToLamports(10),
  largeTxThresholdLamports: solToLamports(2),
});

// AI can now trade autonomously within limits
await aegis.requestSwap({
  vaultPubkey: vault,
  amount: solToLamports(0.5), // Small trade - executes immediately
  fromMint: WSOL_MINT,
  toMint: USDC_MINT,
  amountOutMin: solToLamports(0.45),
});
```

### Testing
```bash
pnpm test              # Run all tests
pnpm --filter program test    # Program tests
pnpm --filter sdk test        # SDK tests
```

## 🏆 Built With

- **Anchor** - Solana smart contract framework
- **Next.js + TypeScript** - Modern React frontend
- **Solana Web3.js** - Blockchain interaction
- **Tailwind CSS** - Utility-first styling

## 📚 Documentation

- [Architecture Details](docs/architecture.md) - Technical implementation
- [API Reference](sdk/README.md) - SDK documentation

## 📦 Tokenomics: Aegis Emission Vault

- Mint: `$AEGIS`, decimals = 9, mint authority PDA `["reward_minter"]`, no freeze authority.
- Genesis mint (one-time): `18,000,000,000 * 10^9` tokens into `emission_vault` PDA (fits within `u64`).
- Emission vault account stores: `bump`, `last_distribution_ts`, `weekly_amount` (`1,000,000,000 * 10^9`).
- Weekly distribution (permissionless trigger):
  - Requires ≥7 days since `last_distribution_ts` (Clock sysvar).
  - 60% to `lm_vault` PDA (`["lm_vault"]`).
  - 40% to `team_vault` PDA (`["team_vault"]`).
  - Emits `WeeklyDistribution { week, liquidity, team }`.
- Initialization: only admin wallet `EQ5c3ZTo33GFpB2JjCqga3ecnbv9cbRpGqnSYu4Dmyof` can call `initialize_emission_vault` (one-time).
- `team_vault` withdrawal is intentionally locked for now (future 4-of-7 multisig).
- [Frontend Guide](../aegis-frontend/README.md) - UI devnet dashboard

---

## 💡 Principais Melhorias Implementadas

### 🏗️ Arquitetura Simplificada
- **Código mais legível e mantível**: Refatoração completa do programa Anchor
- **Separação de Responsabilidades**: Cada módulo tem propósito claro
- **Estrutura Modular**: Program, SDK, e Frontend bem organizados

### 🔧 Type Safety Completo
- **TypeScript em todo o frontend**: Next.js 14 com tipagem rigorosa
- **SDK Type-Safe**: Interfaces bem definidas para todas as operações
- **Validação em Tempo de Compilação**: Menos bugs em produção

### 🎨 Modern Stack Tecnológico
- **Next.js 14 + React 18**: Framework mais recente para melhor performance
- **Tailwind CSS**: Sistema de design consistente e responsivo
- **Anchor 0.32.0**: Versão estável do framework Solana

### 🔗 Wallet Integration Completa
- **Suporte completo a carteiras Solana**: Phantom, Solflare, Backpack
- **Conexão automática**: Detecção e reconexão automática
- **Feedback visual**: Estados de loading e erro bem definidos

### 🧪 Testes Abrangentes
- **Testes de unidade**: Cobertura completa do programa
- **Testes de integração**: Frontend + SDK funcionando
- **Testes E2E**: Fluxo completo usuário validado

### 📚 Documentação Técnica
- **Guias detalhados**: Como usar, integrar e contribuir
- **Exemplos práticos**: Code snippets funcionais
- **API Reference**: Documentação completa do SDK

### 🚀 Deploy e CI/CD
- **Scripts de deploy automatizados**: Para devnet e mainnet
- **Configurações de ambiente**: Separação clara entre ambientes
- **Build otimizado**: Binários menores e mais eficientes

### 🔒 Segurança Aprimorada
- **Auditoria de código**: Revisão completa de vulnerabilidades
- **Validações robustas**: Checks em todas as operações críticas
- **Error handling**: Tratamento adequado de erros edge cases

---

**Aegis Protocol** - Empowering AI agents with secure DeFi access on Solana.

*Built for the Solana Hackathon - Where AI meets DeFi security.*