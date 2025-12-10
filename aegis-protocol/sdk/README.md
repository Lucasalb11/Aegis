# Aegis Protocol - TypeScript SDK

TypeScript client library for integrating Aegis Protocol into AI agents and applications.

## 📦 Installation

Create a devnet `.env` (used by tests/examples):

```
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
PROGRAM_ID=41FsEq3HW76tijmW1GxLon4dP8x2Q8m7g9JQ6Y2BFpF1
```

```bash
npm install @aegis/sdk
# or
pnpm add @aegis/sdk
# or
yarn add @aegis/sdk
```

## 🚀 Quick Start

```typescript
import { AegisClient, PolicyConfig } from '@aegis/sdk';
import { Connection, Keypair } from '@solana/web3.js';

// Initialize Aegis client
const connection = new Connection('https://api.devnet.solana.com');
const wallet = Keypair.generate(); // Your AI agent's keypair

const aegis = AegisClient.initAegisClient(connection, wallet, PROGRAM_ID);

// Create a vault with policies
const policyConfig: PolicyConfig = {
  dailySpendLimitLamports: new BN(10 * LAMPORTS_PER_SOL), // 10 SOL daily limit
  largeTxThresholdLamports: new BN(2 * LAMPORTS_PER_SOL), // 2 SOL large tx threshold
};

const { vault, policy } = await aegis.createVault(policyConfig);
console.log('Vault created:', vault.toString());
console.log('Policy created:', policy.toString());
```

## 🔧 API Reference

### AegisClient

#### Constructor
```typescript
AegisClient.initAegisClient(connection: Connection, wallet: Keypair, programId: PublicKey)
```

#### Methods

##### `createVault(policyConfig: PolicyConfig): Promise<{vault: PublicKey, policy: PublicKey, txSignature: string}>`
Creates a new smart vault with specified spending policies.

##### `depositSol(vaultPubkey: PublicKey, amountSol: number): Promise<string>`
Deposits SOL into a vault. Returns transaction signature.

##### `requestSwap(params: SwapRequestParams): Promise<{pendingAction?: PublicKey, txSignature: string}>`
Requests a swap through Jupiter. For small amounts, executes immediately. For large amounts, creates a pending action.

##### `approvePendingAction(pendingActionPubkey: PublicKey): Promise<string>`
Approves and executes a pending action. Returns transaction signature.

##### `getVault(vaultPubkey: PublicKey): Promise<VaultInfo>`
Retrieves vault information and current state.

##### `getPolicy(vaultPubkey: PublicKey): Promise<PolicyInfo>`
Retrieves policy information for a vault.

##### `getPendingActions(vaultPubkey: PublicKey): Promise<PendingActionInfo[]>`
Gets all pending actions for a vault.

### Types

```typescript
interface PolicyConfig {
  dailySpendLimitLamports: BN;
  largeTxThresholdLamports: BN;
}

interface SwapRequestParams {
  vaultPubkey: PublicKey;
  amount: BN;
  fromMint: PublicKey;
  toMint: PublicKey;
  amountOutMin: BN;
  jupiterIx?: TransactionInstruction; // Jupiter IX (preferred)
  jupiterMetas?: AccountMeta[];       // Raw metas (optional if jupiterIx provided)
  jupiterAccounts?: Buffer;           // Serialized Jupiter account metas
  jupiterData?: Buffer;               // Serialized Jupiter instruction data
}

interface VaultInfo {
  owner: PublicKey;
  authority: PublicKey;
  balance: BN;
  dailySpent: BN;
  lastResetTimestamp: BN;
  policy: PublicKey;
  bump: number;
  pendingActionsCount: number;
  isActive: boolean;
}

interface PolicyInfo {
  vault: PublicKey;
  dailySpendLimitLamports: BN;
  largeTxThresholdLamports: BN;
  allowedPrograms: PublicKey[];
  allowedProgramsCount: number;
  bump: number;
  isActive: boolean;
  largeTxCooldownSeconds: number;
}
```

## 🧪 Examples

### AI Agent Integration
```typescript
import { AegisClient, PolicyConfig, SwapRequestParams } from '@aegis/sdk';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { AegisClient as Client } from '@aegis/sdk';

// Initialize client
const connection = new Connection('https://api.devnet.solana.com');
const aiWallet = Keypair.generate();
const aegis = AegisClient.initAegisClient(connection, aiWallet, PROGRAM_ID);

// Create vault for AI agent
const policyConfig: PolicyConfig = {
  dailySpendLimitLamports: new BN(5 * LAMPORTS_PER_SOL),   // 5 SOL daily
  largeTxThresholdLamports: new BN(1 * LAMPORTS_PER_SOL),  // 1 SOL threshold
};

const { vault } = await aegis.createVault(policyConfig);

// AI agent executes small trade (immediate execution)
const swapParams: SwapRequestParams = {
  vaultPubkey: vault,
  amount: new BN(0.5 * LAMPORTS_PER_SOL),        // 0.5 SOL
  fromMint: WSOL_MINT,                           // wSOL
  toMint: USDC_MINT,                            // USDC
  amountOutMin: new BN(0.45 * LAMPORTS_PER_SOL), // Min 0.45 USDC
};

await aegis.requestSwap(swapParams); // Executes immediately
console.log('Trade executed within policy limits');

// AI agent attempts large trade (requires approval)
const largeSwapParams: SwapRequestParams = {
  vaultPubkey: vault,
  amount: new BN(1.5 * LAMPORTS_PER_SOL),        // 1.5 SOL (above threshold)
  fromMint: WSOL_MINT,
  toMint: USDC_MINT,
  amountOutMin: new BN(1.35 * LAMPORTS_PER_SOL),
};

const { pendingAction } = await aegis.requestSwap(largeSwapParams);
// pendingAction created - requires manual approval
```

### Jupiter route serialization helper
When fetching swap instructions from Jupiter, serialize metas and data before sending to `requestSwap`:

```typescript
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { AegisClient } from '@aegis/sdk';

// Suppose you already called the Jupiter quote + swap-instructions REST endpoints
const jupiterIx: TransactionInstruction = new TransactionInstruction({
  programId: new PublicKey(response.swapInstruction.programId),
  keys: response.swapInstruction.accounts.map((a) => ({
    pubkey: new PublicKey(a.pubkey),
    isSigner: a.isSigner,
    isWritable: a.isWritable,
  })),
  data: Buffer.from(response.swapInstruction.data, 'base64'),
});

const metas = AegisClient.serializeJupiterMetas(jupiterIx.keys);

await aegis.requestSwap({
  vaultPubkey: vault,
  amount: amountLamports,
  fromMint: inputMint,
  toMint: outputMint,
  amountOutMin: new BN(response.quote.otherAmountThreshold),
  jupiterIx,
  jupiterAccounts: metas,
  jupiterData: jupiterIx.data,
});
```

### Policy Monitoring
```typescript
// Monitor vault for policy violations
aegis.on('policyViolation', (violation) => {
  console.log('Policy violation detected:', violation);
  // Send alert to admin
  // Log violation for audit
});

// Monitor spending limits
aegis.on('dailyLimitWarning', (vault, remaining) => {
  console.log(`Daily limit warning: ${remaining} remaining`);
});
```

## 📚 Example Scripts

Run the example scripts to see Aegis Protocol in action:

```bash
# Create a vault and deposit SOL
npx tsx scripts/create-vault-and-deposit.ts

# Simulate AI agent making small and large swaps
npx tsx scripts/simulate-ai-small-swap.ts
```

### Scripts Overview

- **`create-vault-and-deposit.ts`**: Demonstrates basic vault creation and SOL deposits
- **`simulate-ai-small-swap.ts`**: Shows AI agent behavior with policy enforcement

## 🧪 Testing

```bash
# Build the SDK
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm typecheck
```

## 📋 TODO

- [ ] Jupiter API integration for real quotes and routes
- [ ] WebSocket support for real-time vault monitoring
- [ ] Batch transaction support
- [ ] Advanced policy templates and customization
- [ ] Multi-signature approval workflows
- [ ] React hooks library for frontend integration
- [ ] Comprehensive error handling and recovery