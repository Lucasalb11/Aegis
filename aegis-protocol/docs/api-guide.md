# 📚 Guia da API - Aegis Protocol SDK

Este guia mostra como usar o Aegis Protocol SDK para interagir com pools AMM e vaults seguros.

## 🚀 Instalação

```bash
npm install @aegis/sdk
# ou
yarn add @aegis/sdk
```

## 🔧 Configuração Inicial

```typescript
import { Aegis, Pool } from '@aegis/sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';

// Configuração da conexão
const connection = new Connection('https://api.devnet.solana.com');

// Seu wallet (Phantom, Solflare, etc.)
const wallet = useWallet(); // ou seu adapter

// Inicializar Aegis
const aegis = Aegis.fromWallet(connection, wallet, {
  programId: new PublicKey('AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu'),
  cluster: 'devnet'
});
```

## 🏊 Trabalhando com Pools AMM

### Criar um Pool

```typescript
// Mints dos tokens
const tokenA = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
const tokenB = new PublicKey('So11111111111111111111111111111111111111112'); // SOL

// Criar pool com 0.3% de fee
const pool = await aegis.getOrCreatePool(tokenA, tokenB, 30);

console.log('Pool criado:', pool.info.address.toString());
```

### Adicionar Liquidez

```typescript
// Preparar contas de token do usuário
const userTokenA = await getAssociatedTokenAddress(tokenA, wallet.publicKey);
const userTokenB = await getAssociatedTokenAddress(tokenB, wallet.publicKey);
const userLpToken = await getAssociatedTokenAddress(pool.info.lpMint, wallet.publicKey);

// Adicionar liquidez (exemplo: 1000 USDC + 1000 SOL equivalente)
const result = await pool.addLiquidity({
  amountA: new BN(1000 * 10**6),  // 1000 USDC (6 decimals)
  amountB: new BN(1000 * 10**9),  // 1000 SOL (9 decimals)
}, userTokenA, userTokenB, userLpToken);

console.log('LP tokens recebidos:', result.lpTokens.toString());
```

### Fazer um Swap

```typescript
// Swap de 100 USDC para SOL (mínimo 95 SOL)
const swapResult = await pool.swap({
  amountIn: new BN(100 * 10**6),      // 100 USDC
  minAmountOut: new BN(95 * 10**9),   // Mínimo 95 SOL
  aToB: true                          // USDC -> SOL
}, userTokenA, userTokenB);

console.log('SOL recebidos:', swapResult.amountOut.toString());
```

### Remover Liquidez

```typescript
// Remover 50% da liquidez
const lpAmount = pool.info.lpSupply.div(new BN(2));

await pool.removeLiquidity(lpAmount, userLpToken, userTokenA, userTokenB);
```

## 🔒 Trabalhando com Vaults Seguros

### Criar um Vault

```typescript
// Configurar políticas de segurança
const vault = await aegis.createVault({
  dailySpendLimitLamports: new BN(10 * 10**9),    // 10 SOL por dia
  largeTxThresholdLamports: new BN(2 * 10**9),    // 2 SOL threshold
  allowedPrograms: [
    new PublicKey('JUP6LkbZbjS3j5b3sVoEtD9tGWpRQdRr4M3TpXf6dA4'), // Jupiter
    new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'), // Raydium
  ]
});
```

### Depositar SOL no Vault

```typescript
// Depositar 5 SOL
await aegis.depositSol(vault.address, new BN(5 * 10**9));
```

### Solicitar Swap via Vault

```typescript
// Swap pequeno (auto-executa)
const smallSwap = await aegis.requestSwap({
  vaultAddress: vault.address,
  amountIn: new BN(1 * 10**9),        // 1 SOL
  minAmountOut: new BN(20 * 10**6),   // Mínimo 20 USDC
  fromMint: NATIVE_MINT,
  toMint: USDC_MINT,
});

// Swap grande (requer aprovação)
const largeSwap = await aegis.requestSwap({
  vaultAddress: vault.address,
  amountIn: new BN(5 * 10**9),        // 5 SOL
  minAmountOut: new BN(100 * 10**6),  // Mínimo 100 USDC
  fromMint: NATIVE_MINT,
  toMint: USDC_MINT,
});

// Verificar status
console.log('Status do swap:', largeSwap.status); // 'pending'
```

### Aprovar Transação Pendente

```typescript
// Como owner, aprovar transação pendente
await aegis.approvePendingAction(largeSwap.pendingActionAddress);

// Verificar se executou
const updatedAction = await aegis.getPendingAction(largeSwap.pendingActionAddress);
console.log('Status após aprovação:', updatedAction.status); // 'executed'
```

## 📊 Consultas e Monitoramento

### Listar Pools

```typescript
// Todos os pools
const allPools = await aegis.getPools();

// Pools criados pelo usuário
const userPools = await aegis.getUserPools(wallet.publicKey);

// Pool específico
const pool = await aegis.getPool(tokenA, tokenB);
```

### Informações do Pool

```typescript
const pool = await aegis.getPool(tokenA, tokenB);

console.log('Informações do Pool:');
console.log('- Endereço:', pool.info.address.toString());
console.log('- Token A:', pool.info.mintA.toString());
console.log('- Token B:', pool.info.mintB.toString());
console.log('- Fee:', pool.info.feeBps / 100, '%');
console.log('- LP Supply:', pool.info.lpSupply.toString());
```

### Saldos e Posições

```typescript
// Saldo de LP tokens
const lpBalance = await connection.getTokenAccountBalance(userLpToken);

// Reservas do pool
const vaultABalance = await connection.getTokenAccountBalance(pool.info.vaultA);
const vaultBBalance = await connection.getTokenAccountBalance(pool.info.vaultB);

console.log('Suas posições:');
console.log('- LP Tokens:', lpBalance.value.uiAmount);
console.log('- Reserva A:', vaultABalance.value.uiAmount);
console.log('- Reserva B:', vaultBBalance.value.uiAmount);
```

## ⚡ Utilitários

### Calcular Slippage

```typescript
import { calculateSlippage } from '@aegis/sdk';

const amountIn = 1000000; // 1 USDC
const slippageBps = 50;   // 0.5%

const minAmountOut = calculateSlippage(amountIn, slippageBps);
console.log('Quantidade mínima com slippage:', minAmountOut);
```

### Calcular Taxa

```typescript
import { calculateFee } from '@aegis/sdk';

const amount = 1000000;   // 1 USDC
const feeBps = 30;        // 0.3%

const fee = calculateFee(amount, feeBps);
console.log('Taxa cobrada:', fee);
```

## 🔄 Eventos e Webhooks

### Escutar Eventos do Programa

```typescript
// Configurar listener para eventos
const listenerId = connection.onProgramAccountChange(
  aegis.programId,
  (accountInfo, context) => {
    console.log('Mudança na conta do programa:', accountInfo);
  }
);

// Remover listener quando não precisar mais
connection.removeProgramAccountChangeListener(listenerId);
```

### Monitorar Transações Pendentes

```typescript
// Verificar status de ações pendentes periodicamente
const checkPendingActions = async () => {
  const pendingActions = await aegis.getPendingActions(vault.address);

  pendingActions.forEach(action => {
    if (action.expiresAt < Date.now() / 1000) {
      console.log('Ação expirada:', action.address.toString());
    }
  });
};

// Executar a cada 30 segundos
setInterval(checkPendingActions, 30000);
```

## 🛡️ Tratamento de Erros

### Erros Comuns e Soluções

```typescript
try {
  await pool.addLiquidity(params, userTokenA, userTokenB, userLpToken);
} catch (error) {
  if (error.message.includes('InsufficientBalance')) {
    console.error('Saldo insuficiente nos tokens');
  } else if (error.message.includes('SlippageExceeded')) {
    console.error('Slippage muito alto, tente novamente');
  } else if (error.message.includes('VaultNotActive')) {
    console.error('Vault está pausado ou inativo');
  } else {
    console.error('Erro desconhecido:', error);
  }
}
```

### Retry Logic

```typescript
const executeWithRetry = async (operation, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Esperar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// Uso
await executeWithRetry(() => pool.swap(swapParams, userSource, userDest));
```

## 📝 Exemplos Completos

### 🤖 AI Agent Autônomo

```typescript
class AegisAIAgent {
  constructor(private aegis: Aegis, private vault: PublicKey) {}

  async executeTradeIfProfitable(tokenA: PublicKey, tokenB: PublicKey) {
    // Verificar oportunidade de arbitragem
    const profit = await this.calculateArbitrageProfit(tokenA, tokenB);

    if (profit > this.minProfitThreshold) {
      // Executar trade pequeno automaticamente
      if (profit < this.largeTradeThreshold) {
        await this.executeSmallTrade(tokenA, tokenB, profit);
      } else {
        // Solicitar aprovação para trade grande
        await this.requestLargeTradeApproval(tokenA, tokenB, profit);
      }
    }
  }

  private async executeSmallTrade(tokenA: PublicKey, tokenB: PublicKey, amount: number) {
    const pool = await this.aegis.getPool(tokenA, tokenB);
    // Implementar lógica de trade
  }

  private async requestLargeTradeApproval(tokenA: PublicKey, tokenB: PublicKey, amount: number) {
    // Criar pending action para aprovação humana
    await this.aegis.requestLargeTrade(this.vault, tokenA, tokenB, amount);
  }
}
```

### 📊 Dashboard de Monitoramento

```typescript
class PoolMonitor {
  constructor(private aegis: Aegis) {}

  async getPoolStats(poolAddress: PublicKey) {
    const pool = await this.aegis.getPoolByAddress(poolAddress);

    return {
      volume24h: await this.calculateVolume(pool, 24),
      tvl: await this.calculateTVL(pool),
      fees24h: await this.calculateFees(pool, 24),
      apr: await this.calculateAPR(pool),
    };
  }

  private async calculateTVL(pool: Pool): Promise<number> {
    const tokenABalance = await connection.getTokenAccountBalance(pool.info.vaultA);
    const tokenBPrice = await this.getTokenPrice(pool.info.mintB);

    return tokenABalance.value.uiAmount * tokenBPrice * 2; // Aproximado
  }
}
```

---

## 🔗 Links Úteis

- [Documentação Técnica](../docs/architecture.md)
- [Exemplos no GitHub](https://github.com/your-repo/examples)
- [Suporte Discord](https://discord.gg/aegis)

Para dúvidas específicas, consulte a [documentação completa do SDK](./sdk/README.md) ou abra uma issue no repositório.


