# Aegis Protocol - Frontend Application

Next.js web application for managing Aegis vaults and monitoring AI agent activities.

## 🎨 Features

### Vault Management
- Create and configure smart vaults
- Set spending policies and limits
- Multi-wallet support (Phantom, Solflare, Backpack)
- Real-time balance tracking

### Policy Configuration
- Daily spending limits
- Protocol whitelisting
- Transaction size restrictions
- Time-based controls

### Monitoring & Analytics
- Transaction history
- Policy violation alerts
- Spending analytics
- Agent activity logs

### User Experience
- Clean, intuitive interface
- Mobile-responsive design
- Real-time updates
- Error handling and recovery

## 🚀 Development

### Setup
```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

### Environment Variables
```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=your_program_id_here
NEXT_PUBLIC_NETWORK=devnet
```

### Project Structure
```
src/
├── app/                    # Next.js app router
│   ├── page.tsx           # Home page
│   ├── vaults/            # Vault management
│   ├── policies/          # Policy configuration
│   └── analytics/         # Analytics dashboard
├── components/            # React components
│   ├── ui/               # UI components
│   ├── vaults/           # Vault-specific components
│   └── wallet/           # Wallet integration
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities
│   ├── solana.ts         # Solana utilities
│   ├── sdk.ts            # Aegis SDK integration
│   └── constants.ts      # App constants
└── types/                 # TypeScript types
```

## 🔧 Key Components

### WalletProvider
Handles wallet connection and multi-wallet support.

### VaultManager
Core component for vault creation and management.

### PolicyEngine
Policy configuration and validation interface.

### TransactionMonitor
Real-time transaction tracking and alerts.

## 🧪 Testing

```bash
# Run unit tests
pnpm test

# Run e2e tests
pnpm test:e2e

# Test with coverage
pnpm test:coverage
```

## 📋 TODO

- [ ] Mobile app (React Native)
- [ ] Advanced analytics
- [ ] Notification system
- [ ] Multi-language support
- [ ] Dark mode