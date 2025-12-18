# Aegis Protocol - Comprehensive Testing Guide

## Overview

This guide documents the comprehensive testing infrastructure for the Aegis DeFi protocol on Solana. The testing suite includes automated scripts and manual testing procedures to ensure all protocol features work correctly.

## Testing Infrastructure

### 1. Wallet Funding Script

**Location**: `aegis-protocol/sdk/scripts/fund-wallets.ts`

**Purpose**: Distributes SOL from the faucet wallet to multiple test wallets.

**Usage**:
```bash
cd aegis-protocol/sdk
ts-node scripts/fund-wallets.ts <num-wallets> <amount-per-wallet>
```

**Example**:
```bash
ts-node scripts/fund-wallets.ts 15 0.1
```

This will:
- Generate 15 test wallets (or load existing ones)
- Check balances
- Generate a list of wallets that need funding
- Save wallet information to `test-wallets.json`

**Note**: The script requires manual funding or the faucet wallet's private key. For security, use Solana CLI to fund wallets manually.

### 2. Comprehensive Testing Script

**Location**: `aegis-protocol/sdk/scripts/comprehensive-test.ts`

**Purpose**: Performs end-to-end testing of all protocol features:
- Token minting
- Pool creation
- Adding/removing liquidity
- Swaps
- Multi-wallet interactions

**Usage**:
```bash
cd aegis-protocol/sdk
ts-node scripts/comprehensive-test.ts
```

**What it does**:
1. Generates 15 test wallets
2. Funds wallets from faucet (requires manual setup)
3. Mints 10 custom tokens
4. Creates 15 liquidity pools
5. Adds liquidity to pools
6. Performs 30 swaps across different pools
7. Generates a test report

**Output**: `test-results.json` with detailed results of all operations.

## Frontend Testing

### Real-Time Data Integration

The frontend has been updated to fetch real on-chain data:

1. **usePools Hook** (`src/hooks/usePools.ts`):
   - Fetches all pools from the blockchain
   - Auto-refreshes every 10 seconds
   - Parses pool data from on-chain accounts

2. **useRealPools Hook** (`src/hooks/useRealPools.ts`):
   - Converts on-chain pool data to UI format
   - Calculates TVL, volume, fees, and APR from real balances
   - Updates automatically when pools change

3. **Pool Data Utilities** (`src/utils/poolData.ts`):
   - Calculates pool metrics from vault balances
   - Fetches token metadata
   - Generates pool names and slugs

### Testing Checklist

#### ✅ Wallet Integration
- [ ] Connect Phantom wallet
- [ ] Connect Solflare wallet
- [ ] Switch between wallets
- [ ] Verify wallet balance display
- [ ] Test wallet disconnection

#### ✅ Token Minting
- [ ] Mint new token via UI
- [ ] Verify token appears in wallet
- [ ] Check token metadata (name, symbol, decimals)
- [ ] Mint multiple tokens with different supplies
- [ ] Verify transaction on Solana Explorer

#### ✅ Pool Creation
- [ ] Create pool with two tokens
- [ ] Verify pool appears in pools list
- [ ] Check pool TVL updates correctly
- [ ] Create pools with different fee rates
- [ ] Verify pool creation transaction

#### ✅ Adding Liquidity
- [ ] Add liquidity to existing pool
- [ ] Verify LP tokens received
- [ ] Check pool TVL increases
- [ ] Add liquidity with different ratios
- [ ] Test edge cases (minimal amounts)

#### ✅ Removing Liquidity
- [ ] Remove partial liquidity
- [ ] Remove full liquidity
- [ ] Verify tokens returned correctly
- [ ] Check LP tokens burned
- [ ] Verify pool TVL decreases

#### ✅ Swaps
- [ ] Perform simple swap
- [ ] Verify exchange rate calculation
- [ ] Check slippage protection
- [ ] Test swaps with different amounts
- [ ] Verify transaction fees
- [ ] Test failing scenarios (insufficient balance)

#### ✅ UI/UX
- [ ] Verify real-time data updates
- [ ] Check loading states
- [ ] Test error handling
- [ ] Verify responsive design
- [ ] Check transaction status display

## Manual Testing Procedure

### Step 1: Setup

1. Ensure you're connected to Solana devnet:
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```

2. Fund the faucet wallet:
   ```bash
   solana airdrop 10 EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z
   ```

3. Generate test wallets:
   ```bash
   cd aegis-protocol/sdk
   ts-node scripts/fund-wallets.ts 15 0.1
   ```

### Step 2: Run Automated Tests

```bash
cd aegis-protocol/sdk
ts-node scripts/comprehensive-test.ts
```

Review the generated `test-results.json` for any failures.

### Step 3: Manual Frontend Testing

1. Open the application: https://aegis-ashen-alpha.vercel.app/pools
2. Connect your wallet
3. Follow the testing checklist above
4. Verify all transactions on Solana Explorer

### Step 4: Verify On-Chain Data

After testing, verify:
- All pools are visible in the UI
- TVL calculations are correct
- Token balances match on-chain data
- Transaction history is accurate

## Bug Reporting

When you find a bug, document it with:

1. **Description**: What happened?
2. **Steps to Reproduce**: How to trigger the bug
3. **Expected Behavior**: What should happen?
4. **Actual Behavior**: What actually happened?
5. **Transaction Signature**: If applicable
6. **Screenshots**: Visual evidence
7. **Environment**: Browser, wallet, network

## Known Issues & Fixes

### Fixed Issues

1. **Mock Data in Frontend**
   - **Issue**: Frontend was using hardcoded mock pool data
   - **Fix**: Updated `usePools` hook to fetch real on-chain data
   - **Files Changed**: 
     - `src/hooks/usePools.ts`
     - `src/hooks/useRealPools.ts` (new)
     - `src/utils/poolData.ts` (new)
     - `app/pools/page.tsx`

2. **No Auto-Refresh**
   - **Issue**: Pool data didn't update automatically
   - **Fix**: Added polling every 10 seconds in `usePools` hook
   - **Files Changed**: `src/hooks/usePools.ts`

3. **Missing Real Metrics**
   - **Issue**: TVL, volume, and APR were hardcoded
   - **Fix**: Calculate from on-chain vault balances
   - **Files Changed**: `src/utils/poolData.ts`

### Pending Issues

- [ ] Historical volume data needs transaction history tracking
- [ ] APR calculation is simplified (needs fee tracking over time)
- [ ] Token price fetching should use oracles instead of cache
- [ ] Need websocket subscriptions for real-time updates (currently polling)

## Performance Considerations

- Polling interval: 10 seconds (configurable)
- Batch RPC calls where possible
- Cache token metadata to reduce RPC calls
- Consider using websockets for real-time updates in production

## Security Notes

- Never commit private keys or seed phrases
- Test wallets should use minimal SOL
- Use devnet for all testing
- Verify all transactions before signing

## Next Steps

1. Implement transaction history tracking for accurate volume/fees
2. Integrate price oracles for real USD values
3. Add websocket subscriptions for instant updates
4. Create E2E tests with Playwright/Cypress
5. Add performance monitoring

## Resources

- Solana Explorer: https://explorer.solana.com/
- Devnet RPC: https://api.devnet.solana.com
- Program ID: `AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu`
- Faucet Wallet: `EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z`

