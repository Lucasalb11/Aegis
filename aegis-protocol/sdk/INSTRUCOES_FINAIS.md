# 🎯 INSTRUÇÕES FINAIS PARA CRIAR POOLS

## ✅ O QUE JÁ ESTÁ PRONTO

1. ✅ Wallet treasury criada: `12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV`
2. ✅ 15 SOL transferidos para treasury
3. ✅ Script corrigido usando Anchor client (`create-pools-with-anchor.ts`)
4. ✅ 50 wallets criadas e financiadas com SOL

## ⚠️ AÇÃO NECESSÁRIA: TRANSFERIR TOKENS PARA TREASURY

**Os tokens mintados (1 bilhão cada) precisam estar na treasury wallet antes de criar pools!**

### Verificar onde estão os tokens:
```bash
# Verificar tokens em qualquer wallet
spl-token accounts --owner <wallet-address> --url devnet
```

### Transferir tokens para treasury:
```bash
# Para cada token, transferir da wallet atual para a treasury
spl-token transfer <TOKEN_MINT> <AMOUNT> 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV --url devnet --allow-unfunded-recipient

# Exemplo:
# spl-token transfer GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9 1000000000000 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV --url devnet --allow-unfunded-recipient
```

### OU mintar diretamente na treasury:
Se você tem a mint authority, pode mintar diretamente na treasury:
```bash
# Criar ATA na treasury primeiro
spl-token create-account <TOKEN_MINT> --owner 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV --url devnet

# Mintar tokens
spl-token mint <TOKEN_MINT> <AMOUNT> 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV --url devnet
```

## 🚀 EXECUTAR CRIAÇÃO DE POOLS

Após transferir os tokens para a treasury:

```bash
cd aegis-protocol/sdk
npm run create:pools
```

Este script vai:
1. ✅ Criar pools usando Anchor client (corrige o erro DeclaredProgramIdMismatch)
2. ✅ Criar pools: AERO/AEGIS, ABTC/AEGIS, AUSD/AEGIS, ASOL/AEGIS
3. ✅ Adicionar liquidez inicial (1,000 tokens de cada lado)
4. ✅ Verificar se pools já existem (idempotente)

## 📊 POOLS QUE SERÃO CRIADAS

1. **AERO/AEGIS** - 1,000 AERO : 1,000 AEGIS
2. **ABTC/AEGIS** - 1,000 ABTC : 1,000 AEGIS  
3. **AUSD/AEGIS** - 1,000 AUSD : 1,000 AEGIS
4. **ASOL/AEGIS** - 1,000 ASOL : 1,000 AEGIS

Todas com fee de 0.3% (30 bps).

**Nota**: Usando AEGIS como base token (em vez de USDC) porque USDC não foi encontrado na devnet.

## 🔍 VERIFICAÇÕES

### Verificar tokens na treasury:
```bash
spl-token accounts --owner 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV --url devnet
```

### Verificar pools criadas:
```bash
# Após executar o script, verificar no explorer
# https://explorer.solana.com/?cluster=devnet
```

## 🎯 RESULTADO ESPERADO

Após executar `npm run create:pools`:
- ✅ 4 pools criadas com liquidez inicial
- ✅ Pools aparecem no frontend automaticamente (frontend busca on-chain)
- ✅ Swaps funcionam imediatamente
- ✅ Volume pode ser gerado através de swaps reais

