# Pool Initialization and Volume Generation Script

Este script automatiza a criação de pools AMM, adição de liquidez distribuída e geração de volume de trading no protocolo Aegis na devnet da Solana.

## ⚠️ Avisos de Segurança

- **NUNCA** commite chaves privadas no controle de versão!
- Este script é **APENAS para DEVNET** - não use na mainnet!
- Mantenha o arquivo `wallets.json` seguro e adicione-o ao `.gitignore`

## 📋 Pré-requisitos

```bash
npm install @solana/web3.js @solana/spl-token ts-node dotenv
# ou
yarn add @solana/web3.js @solana/spl-token ts-node dotenv
```

## 🚀 Uso Básico

```bash
# Usar configurações padrão
ts-node initialize-pools-and-generate-volume.ts

# Especificar número de pools e swaps
ts-node initialize-pools-and-generate-volume.ts --pools=5 --swaps=20

# Especificar número de wallets
ts-node initialize-pools-and-generate-volume.ts --wallets=50

# Configuração completa
ts-node initialize-pools-and-generate-volume.ts --pools=10 --swaps=30 --wallets=50 --liquidity=100 --minSwap=10 --maxSwap=100
```

## 📝 Parâmetros CLI

- `--pools=N` - Número de pools para criar (padrão: 5)
- `--swaps=N` - Número de swaps por pool (padrão: 20)
- `--wallets=N` - Número de wallets para usar (padrão: 50)
- `--liquidity=N` - Quantidade de liquidez por wallet em unidades base (padrão: 100)
- `--minSwap=N` - Quantidade mínima para swaps em unidades base (padrão: 10)
- `--maxSwap=N` - Quantidade máxima para swaps em unidades base (padrão: 100)

## 🔧 Variáveis de Ambiente

Crie um arquivo `.env` ou exporte as variáveis:

```bash
# RPC Endpoint (padrão: https://api.devnet.solana.com)
export AEGIS_RPC_ENDPOINT=https://api.devnet.solana.com

# Program ID do Aegis Protocol
export AEGIS_PROGRAM_ID=AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu

# Caminho para arquivo de wallets (padrão: ./.secrets/devnet/wallets.json)
export WALLETS_FILE=./wallets.json
```

## 📁 Estrutura do Arquivo de Wallets

O script cria/usa um arquivo JSON com a seguinte estrutura:

```json
[
  {
    "publicKey": "ABC123...",
    "privateKey": "base64encodedsecretkey..."
  },
  ...
]
```

**⚠️ IMPORTANTE**: Este arquivo contém chaves privadas! Nunca o commite no git!

## 🔄 O que o Script Faz

1. **Carrega Wallets**: Carrega wallets de um arquivo ou gera novas
2. **Cria Pools**: Cria pools AMM para pares de tokens configurados
3. **Adiciona Liquidez**: Distribui liquidez entre múltiplas wallets
4. **Gera Volume**: Executa swaps randômicos para simular atividade de mercado
5. **Monitora Status**: Mostra status final dos pools criados

## 📊 Exemplo de Saída

```
🚀 Aegis Protocol - Pool Initialization & Volume Generation
==========================================================

Configuration:
  Pools to create: 5
  Swaps per pool: 20
  Wallets: 50
  ...

🏊 Creating 5 pools...
[1/5] Creating pool: AEGIS/AERO
  ✅ Pool address: ABC123...

💧 Adding liquidity to pools...
📊 Pool: AEGIS/AERO
  Using 10 wallets for liquidity
  ✅ Wallet 1: Added liquidity
  ...

🔄 Generating trading volume...
📊 Pool: AEGIS/AERO
  Target: 20 swaps
  ✅ Completed 5/20 swaps
  ✅ Pool complete: 20/20 successful swaps

📈 Volume Generation Summary:
  Total swaps attempted: 100
  Successful swaps: 95
  Success rate: 95.00%

✅ Script completed successfully!
```

## 🐛 Troubleshooting

### Erro: "Insufficient balance"
- O script tenta fazer airdrop automaticamente
- Se falhar, você pode fazer airdrop manualmente:
  ```bash
  solana airdrop 2 <WALLET_ADDRESS> --url devnet
  ```

### Erro: "Rate limit"
- O script aguarda automaticamente e tenta novamente
- Considere reduzir o número de operações simultâneas

### Erro: "Pool already exists"
- O script usa `getOrCreatePool`, então pools existentes são reutilizados
- Para criar novos pools, use diferentes pares de tokens

## 📚 Dependências

- `@solana/web3.js` - Cliente Solana
- `@solana/spl-token` - Tokens SPL
- `ts-node` - Executar TypeScript diretamente
- `dotenv` - Carregar variáveis de ambiente (opcional)

## 🔗 Links Úteis

- [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)
- [Aegis Protocol GitHub](https://github.com/Lucasalb11/Aegis)
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
