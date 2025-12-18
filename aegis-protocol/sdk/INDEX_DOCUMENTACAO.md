# 📚 ÍNDICE DE DOCUMENTAÇÃO - AEGIS DEVNET SETUP

## 🎯 COMEÇAR AQUI

### Para Ações Imediatas:
👉 **`ACAO_IMEDIATA.md`** - Guia de ações imediatas com comandos prontos

### Para Entender Tudo em Detalhes:
👉 **`RECAPITULACAO_COMPLETA.md`** - Documentação completa do projeto

## 📋 DOCUMENTOS ESSENCIAIS

### 📊 Documentação Principal
- `RECAPITULACAO_COMPLETA.md` - **DOCUMENTO PRINCIPAL** - Tudo que foi feito e precisa ser feito
- `ACAO_IMEDIATA.md` - **AÇÕES IMEDIATAS** - Próximos passos com comandos prontos
- `README.md` - README do SDK com instruções gerais
- `scripts/README-POOL-INIT.md` - README específico de inicialização de pools

## 🔑 INFORMAÇÕES CRÍTICAS (COPIE ESTAS)

### Wallets e Program ID
```
Program ID:        AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu
Upgrade Authority: EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z
Treasury:          12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV
RPC:               https://api.devnet.solana.com
```

### Tokens Mintados
```
AEGIS: GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9
AERO:  DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3
ABTC:  3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc
AUSD:  D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys
ASOL:  7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15
```

### Saldos Atuais
```
Upgrade Authority: 1.92 SOL (precisa 4.54 SOL) - FALTA 2.6 SOL
Treasury:          0.056 SOL (precisa 6 SOL)   - FALTA 5.9 SOL
```

## 🚀 COMANDOS RÁPIDOS

### Verificar Saldos
```bash
solana balance EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z --url devnet
solana balance 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV --url devnet
```

### Transferir SOL
```bash
# Para upgrade authority
solana transfer EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z 3 --url devnet

# Para treasury
solana transfer 12tqa8niRkS3aMtbzjSYHEhHtWHsLzcj94jw5BWM8MgV 6 --url devnet
```

### Fazer Upgrade
```bash
cd aegis-protocol/program
solana program deploy target/deploy/aegis_protocol.so \
  --program-id AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu \
  --url devnet \
  --upgrade-authority /Users/lucas/.config/solana/id.json
```

### Executar Setup
```bash
cd aegis-protocol/sdk
AEGIS_PROGRAM_ID=AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu \
INITIAL_LIQUIDITY_USD_EQUIV=1000 \
npx ts-node scripts/recover-and-setup-pools.ts
```

## 📁 ESTRUTURA DE ARQUIVOS

```
aegis-protocol/
├── program/
│   ├── src/
│   │   ├── lib.rs (Program ID)
│   │   ├── pool.rs (Código corrigido)
│   │   └── state.rs (Pool struct)
│   └── target/deploy/aegis_protocol.so (Binário)
├── sdk/
│   ├── scripts/
│   │   ├── recover-and-setup-pools.ts (PRINCIPAL)
│   │   ├── setup-complete-devnet.ts (Alternativo)
│   │   └── close-all-buffers.sh (Fechar buffers)
│   ├── config/
│   │   ├── devnet.tokens.json (Tokens)
│   │   └── devnet.pools.json (Será gerado)
│   └── *.md (Documentação)
└── local/
    └── wallets/ (50 wallets)
```

## ✅ CHECKLIST FINAL

- [ ] Ler `ACAO_IMEDIATA.md` para ações imediatas
- [ ] Ler `RECAPITULACAO_COMPLETA.md` para detalhes completos
- [ ] Transferir 3 SOL para upgrade authority
- [ ] Fazer upgrade do programa
- [ ] Transferir 6 SOL para treasury
- [ ] Executar script de setup
- [ ] Verificar pools criadas
- [ ] Verificar pools no frontend

## 🔍 Verificar Status Rapidamente

Use o script de verificação de status:
```bash
cd aegis-protocol/sdk
npx ts-node scripts/check-status.ts
```

---

**Última atualização:** Agora
**Status:** Aguardando SOL para upgrade e execução do setup
