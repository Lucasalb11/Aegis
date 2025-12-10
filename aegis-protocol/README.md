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
# sdk/.env
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
PROGRAM_ID=41FsEq3HW76tijmW1GxLon4dP8x2Q8m7g9JQ6Y2BFpF1

# aegis-frontend/.env
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=41FsEq3HW76tijmW1GxLon4dP8x2Q8m7g9JQ6Y2BFpF1
NEXT_PUBLIC_CLUSTER=devnet
NEXT_PUBLIC_EXPLORER_BASE=https://explorer.solana.com
NEXT_PUBLIC_JUPITER_PROGRAM_ID=JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4
```

```bash
# Clone & install
git clone <your-repo-url>
cd aegis-protocol && pnpm install

# Build & deploy program (devnet)
cd program
anchor build && anchor deploy --provider.cluster devnet --provider.wallet ~/.config/solana/id.json

# Frontend (Next.js)
cd ../aegis-frontend && pnpm install && pnpm dev --port 3000
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
- [Frontend Guide](../aegis-frontend/README.md) - UI devnet dashboard

---

**Aegis Protocol** - Empowering AI agents with secure DeFi access on Solana.

*Built for the Solana Hackathon - Where AI meets DeFi security.*