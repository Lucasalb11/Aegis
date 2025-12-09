# Aegis Protocol - Technical Architecture

## Overview

Aegis Protocol implements programmable on-chain vaults that enable AI agents to autonomously manage crypto funds while enforcing safety guardrails. The system consists of Anchor programs, TypeScript SDK, and React frontend working together to provide secure DeFi access.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Human Owner   │    │  Aegis Program  │    │   DeFi Protocol │
│   (Frontend)    │    │   (Anchor)      │    │   (Jupiter)     │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Configure   │─┼───▶│ │ Smart Vault │─┼───▶│ │ Execute Swap│ │
│ │ Policies    │ │    │ │   (PDA)     │ │    │ │   (CPI)     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Agent      │    │ Policy Engine  │    │ Cross-Program   │
│   (SDK)         │    │ (On-chain)     │    │ Invocation      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Request Tx  │◀┼───│ │ Validate &  │◀┼───│ │ CPI to       │ │
│ │ (Autonomous)│ │    │ │ Enforce     │ │    │ │ Jupiter      │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Smart Vault (PDA)

**Purpose**: Gas-efficient on-chain fund storage with policy enforcement.

**Technical Details**:
- **Address**: `findProgramAddress([b"vault", owner_pubkey], program_id)`
- **Storage**: Uses Anchor's `Account` derive macro for automatic serialization
- **Security**: Only owner can withdraw, AI agents can only execute within policies

**Data Structure**:
```rust
#[account]
pub struct Vault {
    pub owner: Pubkey,           // Human owner
    pub authority: Pubkey,       // AI agent authority
    pub balance: u64,           // Current SOL balance
    pub daily_spent: u64,       // Lamports spent today
    pub last_reset_timestamp: i64, // Daily reset tracking
    pub policy: Pubkey,         // Associated policy PDA
    pub bump: u8,              // PDA bump
    pub pending_actions_count: u8, // Active pending actions
    pub is_active: bool,       // Emergency pause
    pub _reserved: [u8; 7],    // Future extensions
}
```

### 2. Policy Engine

**Purpose**: On-chain validation of spending rules and protocol restrictions.

**Key Features**:
- **Daily Limits**: Automatic 24-hour reset based on Solana clock
- **Protocol Whitelist**: Only approved programs (Jupiter MVP)
- **Size Thresholds**: Small transactions auto-execute, large ones require approval

**Data Structure**:
```rust
#[account]
pub struct Policy {
    pub vault: Pubkey,                    // Associated vault
    pub daily_spend_limit_lamports: u64, // Max daily spend
    pub large_tx_threshold_lamports: u64, // Approval threshold
    pub allowed_programs: [Pubkey; 10],   // Whitelisted programs
    pub allowed_programs_count: u8,       // Active whitelist count
    pub bump: u8,                        // PDA bump
    pub is_active: bool,                 // Policy status
    pub large_tx_cooldown_seconds: u32,  // Cooldown between large tx
    pub _reserved: [u8; 6],              // Future extensions
}
```

### 3. Pending Actions System

**Purpose**: Human approval workflow for large transactions.

**Technical Details**:
- **Address**: `findProgramAddress([b"pending_action", vault_pubkey, count], program_id)`
- **Expiration**: Time-sensitive approvals prevent stale transactions
- **Audit Trail**: Complete history of approvals and rejections

**Data Structure**:
```rust
#[account]
pub struct PendingAction {
    pub vault: Pubkey,           // Associated vault
    pub action_type: ActionType, // SWAP, TRANSFER, etc.
    pub amount_lamports: u64,    // Transaction amount
    pub target_program: Pubkey,  // Target DeFi program
    pub target_account: Pubkey,  // Target account
    pub description: String,     // Human-readable description
    pub requester: Pubkey,       // AI agent that requested
    pub requested_at: i64,       // Request timestamp
    pub expires_at: i64,         // Expiration timestamp
    pub status: ActionStatus,    // PENDING, APPROVED, REJECTED, EXPIRED
    pub approver: Option<Pubkey>, // Who approved (if any)
    pub processed_at: Option<i64>, // Processing timestamp
    pub bump: u8,               // PDA bump
    pub _reserved: [u8; 7],     // Future extensions
}
```

## On-Chain Flows

### Flow 1: Small Transaction (Auto-Execute)

```
AI Agent Request → Policy Validation → ✅ Within Limits → Jupiter CPI → Complete
     ↓                ↓                      ↓                    ↓
  SDK Call      Check Daily Limit      Check Threshold      Execute Swap
  (0.5 SOL)     (Daily: 10 SOL)        (Large: 2 SOL)       Immediate
```

**Implementation**:
```rust
// Policy check passes
if amount <= policy.large_tx_threshold_lamports {
    // Execute Jupiter CPI immediately
    execute_jupiter_swap(&ctx.accounts, amount, amount_out_min, &jupiter_data)?;
    vault.daily_spent += amount;
}
```

### Flow 2: Large Transaction (Approval Required)

```
AI Agent Request → Policy Validation → ❌ Above Threshold → Create Pending → Wait Approval
     ↓                ↓                      ↓                    ↓
  SDK Call      Check Daily Limit      Check Threshold      Human Review
  (1.5 SOL)     (Daily: 10 SOL)        (Large: 2 SOL)       Manual Action
                                                        ↓
Human Approval → Policy Re-validation → Jupiter CPI → Complete
```

**Implementation**:
```rust
// Policy check fails - create pending action
if amount > policy.large_tx_threshold_lamports {
    let pending_action = ctx.accounts.pending_action.as_mut().unwrap();
    // Initialize pending action with Jupiter data
    // Wait for human approval
}

// Later: Human approves
pub fn approve_pending_action(ctx: Context<ApprovePendingAction>) -> Result<()> {
    let pending_action = &mut ctx.accounts.pending_action;
    // Execute stored Jupiter CPI with original parameters
    execute_jupiter_swap(/* stored params */)?;
    pending_action.status = ActionStatus::Approved;
}
```

## Cross-Program Invocation (CPI)

### Jupiter Integration

**Purpose**: Direct execution of DEX swaps without off-chain dependencies.

**Implementation**:
```rust
fn execute_jupiter_swap(
    source_token_account: AccountInfo,
    destination_token_account: AccountInfo,
    jupiter_program: AccountInfo,
    vault_key: Pubkey,
    vault_bump: u8,
    jupiter_data: &[u8],
) -> Result<()> {
    // Deserialize Jupiter instruction
    let jupiter_ix = Instruction {
        program_id: jupiter_program.key(),
        accounts: vec![
            AccountMeta::new(source_token_account.key(), false),
            AccountMeta::new(destination_token_account.key(), false),
            AccountMeta::new_readonly(vault_key, true), // Vault PDA authority
        ],
        data: jupiter_data.to_vec(),
    };

    // Execute with vault PDA signature
    let vault_seeds = &[b"vault", vault_key.as_ref(), &[vault_bump]];
    anchor_lang::solana_program::program::invoke_signed(
        &jupiter_ix,
        &[source_token_account, destination_token_account],
        &[vault_seeds],
    )?;

    Ok(())
}
```

## Security Considerations

### On-Chain Enforcement
- **Unbypassable Rules**: All validation happens in the Solana runtime
- **No Off-Chain Dependencies**: Pure blockchain execution
- **PDA Security**: Program-derived addresses prevent address reuse attacks

### Time-Sensitive Operations
- **Daily Resets**: Automatic policy refresh based on Solana clock
- **Approval Windows**: Pending actions expire to prevent stale approvals
- **Cooldown Periods**: Prevent rapid-fire large transactions

### Access Control
- **Owner Privileges**: Only vault owner can modify policies or emergency pause
- **AI Agent Limits**: Agents can only execute within policy bounds
- **Multi-Signature Ready**: Architecture supports future multi-sig extensions

## TypeScript SDK Architecture

### Client Initialization
```typescript
export class AegisClient extends EventEmitter {
  private provider: AnchorProvider;
  private program: Program<AegisProtocol>;

  constructor(config: AegisClientConfig) {
    super();
    this.provider = new AnchorProvider(config.connection, config.wallet, {});
    this.program = new Program<AegisProtocol>(IDL, config.programId, this.provider);
  }
}
```

### Method Implementation
```typescript
async requestSwap(params: SwapRequestParams): Promise<{ pendingAction?: PublicKey, txSignature: string }> {
  // Policy validation happens on-chain
  const result = await this.program.methods
    .requestSwapJupiter(amount, amountOutMin, jupiterAccounts, jupiterData)
    .accounts({ /* account mappings */ })
    .rpc();

  return { txSignature: result };
}
```

## Performance Optimizations

### Gas Efficiency
- **PDA Usage**: Program-derived addresses minimize account creation costs
- **Compact Storage**: Efficient serialization with reserved fields for extensions
- **Batch Operations**: Single transaction for validation + execution

### Scalability Considerations
- **Parallel Processing**: Multiple vaults can operate independently
- **Event-Driven**: Webhook support for monitoring without polling
- **Modular Design**: Easy addition of new policy types and protocols

## Future Extensions

### Advanced Policies
- **Time Windows**: Restrict trading to specific hours
- **Volume Limits**: Maximum transaction frequency
- **Risk Scoring**: Dynamic limits based on market conditions

### Multi-Protocol Support
- **DEX Aggregation**: Support for Raydium, Orca, etc.
- **Yield Protocols**: Integration with lending platforms
- **Cross-Chain**: Future bridging capabilities

### Enterprise Features
- **Audit Logging**: Comprehensive transaction history
- **Compliance Tools**: Regulatory reporting support
- **Multi-Signature**: Advanced approval workflows

---

This architecture provides a solid foundation for secure AI agent fund management while maintaining the flexibility to evolve with DeFi innovation.
