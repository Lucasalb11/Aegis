# Aegis Protocol - Solana Student Hackathon Fall 2025

> **Aegis Protocol** is an on-chain security platform for AI agents on Solana, combining secure vaults, AMM (Automated Market Maker), and oracle integration for slippage protection and price manipulation prevention.

## 🎯 Vision

Aegis Protocol revolutionizes AI agent interaction with DeFi on Solana, offering:
- **Secure Vaults**: Granular spending control with human approval for large transactions
- **Integrated AMM**: Token swap system with slippage protection via oracles
- **Enterprise Security**: Rigorous validations following Solana best practices
- **Optimized UX**: Intuitive interface focused on user experience

## 🚀 Features

### Smart Vaults
- ✅ Vault creation with configurable policies
- ✅ Daily spending control and per-transaction limits
- ✅ Approval system for large transactions
- ✅ Support for multiple authorized programs

### AMM (Automated Market Maker)
- ✅ Liquidity pools with constant-product formula
- ✅ Configurable fees per pool
- ✅ LP token system
- ✅ Direct token swaps

### Oracle Integration
- ✅ Support for Pyth and manual oracles
- ✅ Real-time slippage protection
- ✅ Accurate price calculation with impact
- ✅ Data freshness validation

### Modern Frontend
- ✅ Native Phantom Wallet connection
- ✅ Responsive interface with Tailwind CSS
- ✅ Smart selection of available tokens
- ✅ Real-time quotes
- ✅ Live pool statistics

## 🛠️ Stack Tecnológico

- **Blockchain**: Solana (Anchor Framework)
- **Frontend**: Next.js 14 + React + TypeScript
- **Wallet**: Phantom + Solana Wallet Adapter
- **Styling**: Tailwind CSS
- **Oráculos**: Pyth Network + Manual feeds
- **Deploy**: Devnet/Mainnet ready

## 📦 Installation and Usage

### 1. Prerequisites
```bash
# Install dependencies
npm install -g @solana/cli
npm install -g anchor-cli
```

### 2. Clone and Setup
```bash
git clone <repository-url>
cd aegis-protocol

# Install program dependencies
cd aegis-protocol/program
npm install

# Install SDK dependencies
cd ../sdk
npm install

# Install frontend dependencies
cd ../aegis-frontend
npm install
```

### 3. Program Deployment (Devnet)
```bash
cd aegis-protocol/program
anchor build
anchor deploy --provider.cluster devnet
```

### 4. Frontend Configuration
```bash
cd aegis-frontend
cp env.local.example .env.local
# Edit .env.local with your RPC endpoint and program ID
```

### 5. Run Frontend
```bash
npm run dev
```

### 6. Basic Usage

#### Create a Vault
1. Connect your Phantom Wallet
2. Configure daily spending limits
3. Add authorized programs
4. Deposit SOL to start

#### Create an AMM Pool
1. Choose two tokens (must exist on devnet)
2. Set fee rate (e.g., 0.3%)
3. Add initial liquidity
4. Receive LP tokens

#### Execute Swaps
1. Select available tokens from pools
2. Enter desired amount
3. Configure slippage tolerance
4. Execute the swap

## 🔐 Security

Aegis Protocol implements multiple layers of security:

### On-Chain Security
- ✅ Rigorous ownership validation (`is_owned_by`)
- ✅ Checked arithmetic (overflow/underflow protection)
- ✅ Secure PDAs for derived accounts
- ✅ Cross-Program Invocation validation
- ✅ Account size and seeds checks

### Oracle Security
- ✅ Price staleness validation
- ✅ Support for multiple oracle sources
- ✅ Price impact calculation
- ✅ Slippage protection

### Frontend Security
- ✅ Secure wallet connection
- ✅ Input validation
- ✅ Robust error handling
- ✅ Secure transaction UX

## 📊 Architecture

```
Aegis Protocol
├── Program (Rust/Anchor)
│   ├── Vaults - AI spending control
│   ├── AMM - Automated Market Maker
│   ├── Oracles - Price integration
│   └── Validation - On-chain security
├── SDK (TypeScript)
│   ├── AegisClient - High-level interface
│   ├── TypeScript types - Type safety
│   └── Event system - Real-time updates
└── Frontend (Next.js)
    ├── Swap Interface - Token exchange
    ├── Pool Management - Liquidity management
    ├── Wallet Integration - Phantom connection
    └── Analytics - Pool statistics
```

## 🎓 Hackathon Focus

This project was developed specifically for the **Solana Student Hackathon Fall 2025**, meeting the criteria:

- ✅ **Innovation**: Unique security system for AI agents
- ✅ **Open-source**: All code publicly available
- ✅ **Deploy-ready**: Works on devnet/mainnet
- ✅ **Demo-ready**: Professional demo video prepared
- ✅ **Official stack**: Uses Anchor Framework and Solana best practices

## 📈 Roadmap

### Phase 1 (Hackathon) ✅
- Secure vaults with configurable policies
- Basic AMM with constant-product formula
- Manual oracle integration
- Functional frontend with Phantom

### Phase 2 (Next Improvements)
- Full Pyth Network integration
- Governance for pool parameters
- Advanced yield analytics
- Mobile app companion

### Phase 3 (Expansion)
- Cross-chain liquidity
- Advanced order types (limit orders, TWAP)
- Automated risk management
- Institutional-grade features

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under Apache 2.0 - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

- **Email**: seu-email@exemplo.com
- **Discord**: SeuDiscord#1234
- **Twitter**: @SeuTwitter

---

**Built with ❤️ for the Solana Student Hackathon Fall 2025**

*Building the future of secure DeFi for AI agents on Solana* 🚀