# Aegis Frontend 🌐

**Modern Web Interface for Aegis Protocol DEX**

A complete Next.js 14 frontend for the Aegis Protocol AMM DEX, featuring real-time pool data, token swaps, liquidity management, and wallet integration.

## 🚀 Features

### 💱 DEX Interface
- **Token Swapping**: Cross-pool swaps with price impact calculations
- **Liquidity Pools**: Add/remove liquidity with real-time LP token tracking
- **Pool Creation**: Permissionless pool deployment interface
- **Live Analytics**: TVL, volume, and fee tracking

### 🎨 Modern UI/UX
- **Next.js 14**: Latest React framework with app directory
- **Tailwind CSS**: Utility-first styling with dark theme
- **Responsive Design**: Mobile-first approach
- **Real-Time Updates**: Live pool data synchronization

### 🔐 Wallet Integration
- **Phantom/Solflare**: Complete Solana wallet support
- **Auto-Reconnection**: Seamless wallet state management
- **Transaction Feedback**: Real-time transaction status
- **Error Handling**: Comprehensive error states

## 🏗️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS with custom components
- **State Management**: React hooks and context
- **Blockchain**: @solana/web3.js + @solana/wallet-adapter
- **SDK**: @aegis/sdk for protocol integration

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp env.local.example env.local
# Edit NEXT_PUBLIC_AEGIS_PROGRAM_ID

# Start development server
npm run dev

# Build for production
npm run build && npm run start
```

## 📁 Project Structure

```
aegis-frontend/
├── app/                   # Next.js 14 app directory
│   ├── layout.tsx        # Root layout with providers
│   ├── page.tsx          # Homepage
│   ├── pools/            # Pool-related pages
│   ├── swap/             # Swap interface
│   └── globals.css       # Global styles
├── components/           # Reusable React components
│   ├── PoolCard.tsx     # Pool display component
│   ├── TokenSelector.tsx # Token selection dropdown
│   ├── TopNav.tsx       # Navigation header
│   └── ...
├── hooks/                # Custom React hooks
│   ├── usePools.ts      # Pool data management
│   ├── useSwap.ts       # Swap logic
│   └── useAprManager.ts # APR calculations
├── providers/            # Context providers
│   ├── AegisProvider.tsx # Aegis SDK provider
│   └── WalletProviders.tsx # Wallet connection
├── types/                # TypeScript definitions
└── data/                 # Mock data and constants
```

## 🔧 Environment Variables

```env
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_AEGIS_PROGRAM_ID=AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu
```

## 🎯 Key Components

### Pool Management
- **PoolCard**: Displays pool information and actions
- **PoolDetailClient**: Individual pool management interface
- **AddLiquidityModal**: Liquidity provision interface
- **RemoveLiquidityModal**: Liquidity withdrawal interface

### Token Operations
- **TokenSelector**: Token selection with search
- **Swap Interface**: Complete token exchange flow
- **Pool Creation**: New pool deployment

### Wallet Integration
- **Wallet Connection**: Multiple wallet support
- **Transaction Monitoring**: Real-time status updates
- **Error Handling**: User-friendly error messages

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# E2E tests (future)
npm run test:e2e
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Manual Build
```bash
# Build and serve
npm run build
npm run start
```

## 🔗 Integration

### Aegis SDK Usage
```typescript
import { useAegis } from '@/providers/AegisProvider';

function MyComponent() {
  const { aegisClient } = useAegis();

  // Use SDK for DEX operations
  const pools = await aegisClient.getPools();
  const swap = await aegisClient.swap({...});
}
```

### Custom Hooks
```typescript
import { usePools } from '@/hooks/usePools';
import { useSwap } from '@/hooks/useSwap';

function DexInterface() {
  const { pools, loading } = usePools(PROGRAM_ID);
  const { quote, loading: quoteLoading } = useSwap(fromToken, toToken, amount);
}
```

## 🎨 Styling Guide

### Design System
- **Colors**: Dark theme with accent colors
- **Typography**: Inter font family
- **Spacing**: Tailwind spacing scale
- **Components**: Reusable component library

### CSS Classes
- `card-surface`: Card backgrounds
- `input`: Form input styling
- `btn-primary`: Primary button style
- `text-accent-*`: Accent text colors

## 📊 Performance

- **Bundle Size**: Optimized with Next.js code splitting
- **Image Optimization**: Next.js Image component
- **Real-time Updates**: Efficient data fetching
- **Caching**: React Query for data caching

## 🔒 Security

- **Input Validation**: Client and server-side validation
- **Wallet Security**: Secure wallet connection handling
- **Transaction Safety**: Slippage protection and confirmations
- **Error Boundaries**: Graceful error handling

---

**Aegis Frontend** - The complete web interface for Aegis Protocol DEX.

*Built with Next.js 14, powered by Solana.*