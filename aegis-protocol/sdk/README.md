# Aegis Protocol SDK

A TypeScript SDK for interacting with the Aegis Protocol on Solana.

## Installation

```bash
npm install @aegis/sdk
# or
yarn add @aegis/sdk
```

## Quick Start

```typescript
import { Aegis, Pool } from '@aegis/sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';

// Initialize connection
const connection = new Connection('https://api.devnet.solana.com');

// Initialize Aegis with wallet
const aegis = Aegis.fromWallet(connection, wallet);

// Create or get a pool
const mintA = new PublicKey('...'); // Token A mint
const mintB = new PublicKey('...'); // Token B mint

const pool = await aegis.getOrCreatePool(mintA, mintB);

// Add liquidity
const result = await pool.addLiquidity({
  amountA: new BN(1000000), // 1M tokens
  amountB: new BN(1000000), // 1M tokens
}, userTokenA, userTokenB, userLpToken);

// Perform a swap
const swapResult = await pool.swap({
  amountIn: new BN(100000),
  minAmountOut: new BN(95000),
  aToB: true
}, userSourceToken, userDestinationToken);
```

## API Reference

### Aegis

Main class for interacting with the Aegis Protocol.

#### Constructor

```typescript
new Aegis(connection: Connection, wallet: Wallet, config?: Partial<AegisConfig>)
```

#### Methods

- `getPool(mintA: PublicKey, mintB: PublicKey): Promise<Pool | null>`
- `getOrCreatePool(mintA: PublicKey, mintB: PublicKey, feeBps?: number): Promise<Pool>`
- `getPools(): Promise<Pool[]>`
- `getUserPools(user: PublicKey): Promise<Pool[]>`

### Pool

Class representing an AMM pool.

#### Methods

- `addLiquidity(params: LiquidityParams, userTokenA: PublicKey, userTokenB: PublicKey, userLpToken: PublicKey): Promise<AddLiquidityResult>`
- `swap(params: SwapParams, userSource: PublicKey, userDestination: PublicKey): Promise<SwapResult>`
- `refresh(): Promise<void>`

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type checking
npm run typecheck
```

## License

MIT