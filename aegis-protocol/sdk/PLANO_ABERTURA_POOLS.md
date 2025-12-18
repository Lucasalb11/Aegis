# 🚀 PLANO DE ABERTURA DE POOLS - AEGIS PROTOCOL DEVNET

## 📋 WALLET PARA TRANSFERÊNCIA DE SOL

**⚠️ IMPORTANTE: Envie 15 SOL para esta wallet antes de executar o seed script!**

```
Public Key: 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV
```

### Comando para transferir SOL:
```bash
solana transfer 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV 15 --url devnet
```

Ou usando sua faucet wallet:
```bash
# Se você tem uma faucet wallet configurada
solana transfer 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV 15 --url devnet --keypair <path-to-faucet-keypair>
```

---

## 📊 RESUMO DE RECURSOS

### SOL (15 SOL total)
- **Criação de Pools**: ~0.018 SOL (5 pools)
- **Funding Wallets**: ~12.5 SOL (50 wallets × 0.25 SOL)
- **Buffer de segurança**: ~1.3 SOL
- **TOTAL**: ~13.8 SOL
- **Sobra**: ~1.2 SOL para contingências

### Tokens (1 bilhão cada × 10 tokens)
- **USDC** (base): 10,000 tokens (5 pools + 50 wallets)
- **AEGIS**: 6,000 tokens (1 pool + 50 wallets)
- **AERO**: 6,000 tokens (1 pool + 50 wallets)
- **ABTC**: 6,000 tokens (1 pool + 50 wallets)
- **AUSD**: 6,000 tokens (1 pool + 50 wallets)
- **ASOL**: 6,000 tokens (1 pool + 50 wallets)

**Total usado**: ~40,000 tokens (0.004% do supply total)

---

## 🎯 POOLS A CRIAR

1. **AEGIS/USDC** - 1,000 AEGIS : 1,000 USDC
2. **AERO/USDC** - 1,000 AERO : 1,000 USDC
3. **ABTC/USDC** - 1,000 ABTC : 1,000 USDC
4. **AUSD/USDC** - 1,000 AUSD : 1,000 USDC
5. **ASOL/USDC** - 1,000 ASOL : 1,000 USDC

Todas com fee de 0.3% (30 bps).

---

## ✅ CHECKLIST DE EXECUÇÃO

### Fase 1: Preparação
- [x] Wallet treasury gerada
- [ ] **15 SOL transferidos para treasury** ⬅️ **FAÇA ISSO AGORA!**
- [ ] Tokens mintados verificados (1B cada)
- [ ] Tokens transferidos para treasury wallet
- [x] `.env.local` criado
- [x] `devnet.tokens.json` criado

### Fase 2: Configuração
- [ ] Editar `config/devnet.tokens.json` com seus tokens mintados
- [ ] Verificar que todos os tokens existem na devnet
- [ ] Verificar saldo da treasury wallet

### Fase 3: Execução
- [ ] Executar dry-run primeiro:
  ```bash
  cd aegis-protocol/sdk
  DRY_RUN=true npm run seed:devnet
  ```
- [ ] Se tudo OK, executar seed real:
  ```bash
  npm run seed:devnet
  ```

### Fase 4: Validação
- [ ] Verificar pools criadas: `cat config/devnet.pools.json`
- [ ] Verificar no Solana Explorer
- [ ] (Opcional) Executar smoke test: `npm run smoke:devnet`
- [ ] Verificar no frontend

---

## 📝 PRÓXIMOS PASSOS

1. **TRANSFERIR 15 SOL** para a wallet acima
2. **Verificar tokens** na treasury wallet
3. **Editar** `config/devnet.tokens.json` com seus tokens
4. **Executar** o seed script

---

## 🔍 VERIFICAÇÕES

### Verificar saldo da treasury:
```bash
solana balance 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV --url devnet
```

### Verificar tokens na treasury:
```bash
spl-token accounts --owner 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV --url devnet
```

---

**Data de criação**: $(date)
**Status**: Pronto para execução após transferência de SOL
