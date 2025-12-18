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

## Devnet Liquidity Seeding

This section describes how to seed initial liquidity for demo purposes on **DEVNET ONLY**. These scripts are designed to make Aegis Protocol demo-ready with real liquidity pools and test wallets.

### Prerequisites

1. **Treasury Wallet**: A funded wallet with:
   - Sufficient SOL for transaction fees (recommended: 10+ SOL)
   - Tokens to seed pools (mint or acquire tokens listed in `devnet.tokens.json`)

2. **Token Mints**: All tokens must exist on devnet. The script will validate each token before proceeding.

### 1. Setup Configuration

Copy the example environment file and customize:

```bash
cp env.local.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
AEGIS_PROGRAM_ID=FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9
COMMITMENT=confirmed

# Treasury (must have SOL and tokens)
TREASURY_KEYPAIR_PATH=../../.secrets/devnet/treasury.json

# Wallets Directory (50 test wallets)
WALLETS_DIR=../../local/wallets

# Configuration Files
TOKENS_CONFIG_PATH=./config/devnet.tokens.json
POOLS_OUT_PATH=./config/devnet.pools.json

# Base Token (USDC devnet or SOL)
BASE_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Funding Amounts
INITIAL_SOL_PER_WALLET=0.25
INITIAL_TOKEN_PER_WALLET=100
INITIAL_LIQUIDITY_USD_EQUIV=1000

# Pool Configuration
FEE_BPS=30

# Dry Run (set to false to execute)
DRY_RUN=false
```

### 2. Prepare Token Configuration

The script automatically discovers tokens from `config/devnet.tokens.example.json`. Copy and customize:

```bash
cp config/devnet.tokens.example.json config/devnet.tokens.json
```

Edit `config/devnet.tokens.json` with your token mints, symbols, and decimals. Each token must:
- Exist on devnet
- Have the correct decimals
- Be mintable/transferable by the treasury wallet

Example structure:
```json
{
  "tokens": [
    {
      "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6
    }
  ]
}
```

### 3. Prepare Wallets Directory

The script will auto-create 50 wallets in `local/wallets/` if they don't exist. Alternatively, you can pre-create them:

```bash
mkdir -p ../../local/wallets
# Generate wallets (example)
for i in {0..49}; do
  solana-keygen new --outfile ../../local/wallets/wallet-$i.json --no-bip39-passphrase
done
```

**Important**: Never commit wallet keypairs to git. The `local/` directory should be in `.gitignore`.

### 4. Run Seed Script

```bash
npm run seed:devnet
```

**What the script does:**

1. **Validates Configuration**
   - Checks treasury balance
   - Validates all tokens exist on devnet
   - Verifies token decimals

2. **Creates/Verifies Pools**
   - For each token, creates a pool paired with `BASE_TOKEN_MINT` (USDC or wSOL)
   - If pool already exists, skips creation (idempotent)
   - Derives pool address using program seeds

3. **Adds Liquidity**
   - Checks if pool has existing liquidity
   - If no liquidity: adds initial liquidity from treasury
   - If liquidity exists: can top-up (if configured)
   - Liquidity amounts calculated from `INITIAL_LIQUIDITY_USD_EQUIV`

4. **Funds Test Wallets**
   - Creates 50 wallets if they don't exist (or loads existing)
   - Funds each wallet with SOL (`INITIAL_SOL_PER_WALLET`)
   - Funds each wallet with base token + 2-3 other tokens
   - Uses batching and retry logic

5. **Saves Output**
   - Generates `config/devnet.pools.json` with:
     - Pool addresses (PDAs)
     - Vault addresses (ATAs)
     - LP mint addresses
     - Token decimals
     - Timestamps

**Output Example:**
```
🌱 Aegis Protocol - Devnet Liquidity Seeding
============================================================
🔗 RPC: https://api.devnet.solana.com
📦 Program ID: FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9

📂 Loading treasury...
👛 Treasury: <address>
💰 Balance: 10.5000 SOL

📋 Loading tokens configuration...
✅ Loaded 5 tokens

🔍 Validating tokens on devnet...
  ✓ USDC (6 decimals)
  ✓ AEGIS (6 decimals)
✅ Validated 5 tokens

🏊 Creating/verifying pools...
  ✅ Created pool: AEGIS/USDC
  💧 Added initial liquidity: 1000000 / 1000000
  ...

📊 SUMMARY
============================================================
Pools created:     5
Pools existing:    0
Pools topped up:   0
Wallets funded:    50
Errors:            0
```

### 5. Run Smoke Tests (Optional)

After seeding, verify pool functionality with limited smoke tests:

```bash
npm run smoke:devnet
```

**What the smoke test does:**

- Loads pools from `devnet.pools.json` or fetches on-chain
- Selects random wallets and pools
- Executes **ONE swap per wallet** (max `MAX_SMOKE_SWAPS_PER_WALLET`)
- Uses small amounts (10% of wallet balance or minimum 1000 units)
- Calculates `minAmountOut` using actual pool reserves and slippage tolerance
- Validates balances changed after swap
- Randomizes delays (200-800ms) to avoid rate limiting
- **Important**: This is a smoke test, NOT volume generation

Configure smoke test parameters in `.env.local`:

```bash
MAX_SMOKE_SWAPS_TOTAL=30          # Maximum total swaps
MAX_SMOKE_SWAPS_PER_WALLET=1      # Max swaps per wallet
MAX_SLIPPAGE_BPS=100              # 1% slippage tolerance
POOLS_CONFIG_PATH=./config/devnet.pools.json
```

**Smoke Test Output:**
```
💨 Aegis Protocol - Smoke Test Swaps
============================================================
🔗 RPC: https://api.devnet.solana.com
📦 Program ID: FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9

📋 Loading pools configuration...
✅ Loaded 5 pools

👛 Loading wallets...
✅ Loaded 50 wallets

🏊 Found 5 pools on-chain

🔄 Executing smoke test swaps...
  Wallet 1: Swapping 10000 from EPjFWdd...
    ✅ Swap successful: <signature>
       Amount out: 9850
       Balances: A=90000, B=9850

📊 SMOKE TEST SUMMARY
============================================================
Total swaps attempted:  30
Successful swaps:        28
Failed swaps:            2
Wallets used:            28
```

### Output Files

- `config/devnet.pools.json` - Pool addresses, vaults, and metadata
- `config/devnet.smoke.signatures.json` - Smoke test swap signatures and results

### Idempotency

Both scripts are **idempotent** and safe to run multiple times:

**Seed Script:**
- ✅ If pool already exists: skips creation, checks liquidity
- ✅ If pool has liquidity: skips adding more (unless manually configured)
- ✅ If pool exists but empty: adds initial liquidity
- ✅ Wallets: always funds (no balance check), but safe to re-run

**Smoke Test:**
- ✅ Can be run multiple times
- ✅ Each run selects random wallets/pools
- ✅ No state mutation, only reads pools and executes swaps

### Integration with Frontend

The frontend automatically discovers pools **on-chain** using `connection.getProgramAccounts()`. No configuration needed:

- Frontend uses `usePools()` hook which queries all pool accounts
- Pools are discovered automatically by program ID
- Token metadata is fetched from on-chain mints
- No dependency on `devnet.pools.json` (it's for reference only)

The generated `devnet.pools.json` is useful for:
- Reference/debugging
- Smoke test configuration
- Documentation
- Off-chain tooling

### Security Notes

⚠️ **CRITICAL SECURITY REQUIREMENTS:**

1. **DEVNET ONLY**: These scripts are designed for devnet. **NEVER run on mainnet.**

2. **Wallet Storage**: 
   - Wallet keypairs are stored in `local/wallets/` (outside git)
   - Directory is in `.gitignore`
   - **Never commit wallet files**

3. **Treasury Keypair**:
   - Store in `.secrets/devnet/` (also in `.gitignore`)
   - Use a dedicated devnet wallet
   - Never use mainnet keys

4. **Environment Variables**:
   - Use `.env.local` (gitignored)
   - Never hardcode secrets in scripts
   - Use `env.local.example` as template

5. **Token Minting**:
   - Ensure treasury has mint authority for test tokens
   - Or acquire tokens from devnet faucets
   - Verify token balances before running

### Troubleshooting

**Common Issues:**

1. **"Insufficient balance"**
   - Check treasury SOL balance (needs ~10 SOL for fees)
   - Verify treasury has tokens to seed pools
   - Check token ATAs exist and have balance

2. **"Token not found on-chain"**
   - Verify token mint address is correct
   - Ensure token exists on devnet (not mainnet)
   - Check token decimals match on-chain

3. **"Pool creation failed"**
   - Verify program ID is correct
   - Check RPC endpoint is accessible
   - Ensure treasury has enough SOL for rent

4. **"Swap failed in smoke test"**
   - Verify pool has liquidity
   - Check wallet has tokens
   - Increase `MAX_SLIPPAGE_BPS` if needed
   - Verify pool reserves are sufficient

### Next Steps

After seeding:
1. ✅ Pools are live on devnet
2. ✅ Frontend can discover pools automatically
3. ✅ Users can swap, add/remove liquidity
4. ✅ Smoke tests verify basic functionality

For production deployment, follow the same pattern but:
- Use production RPC endpoints
- Secure treasury management
- Proper token distribution
- Comprehensive testing

## License

MIT