# ⚡ Comandos Rápidos - Deploy e Teste de Pools

## 🎯 Tudo Pronto! Execute Estes Comandos:

### 1️⃣ Deploy do Programa (Escolha UMA opção):

#### Opção A: Script Automático (Recomendado)
```bash
cd /Users/lucas/Documents/Programacao/Projetos/Aegis/aegis-protocol/program
./scripts/deploy-with-retry.sh
```

#### Opção B: RPC Privado (Mais Confiável)
```bash
cd /Users/lucas/Documents/Programacao/Projetos/Aegis/aegis-protocol/program
export ANCHOR_PROVIDER_URL="https://devnet.genesysgo.net"
anchor deploy --provider.cluster devnet
```

#### Opção C: Localnet (Para Testes Rápidos)
```bash
# Terminal 1
solana-test-validator

# Terminal 2
cd /Users/lucas/Documents/Programacao/Projetos/Aegis/aegis-protocol/program
anchor deploy
```

### 2️⃣ Testar Criação de Pools
```bash
cd /Users/lucas/Documents/Programacao/Projetos/Aegis/aegis-protocol/sdk
npm run test:sdk-pool
```

### 3️⃣ Testar no Frontend
```bash
cd /Users/lucas/Documents/Programacao/Projetos/Aegis/aegis-frontend
npm run dev
```

## ✅ O Que Foi Corrigido:

- ✅ SDK com discriminators corretos
- ✅ Serialização de u64 corrigida  
- ✅ Program IDs sincronizados
- ✅ Accounts corretos nas instruções
- ✅ Programa compilado com ID correto

## 📚 Documentação Criada:

1. `COMO_PROSSEGUIR.md` - Guia completo
2. `STATUS_FINAL_POOLS.md` - Status detalhado
3. `RELATORIO_TESTE_POOLS.md` - Relatório executivo
4. `POOL_CREATION_ISSUE_DIAGNOSIS.md` - Diagnóstico técnico

## 💡 Dica:

Se o deploy continuar falhando, **use a Opção B (RPC Privado)** - é a mais confiável!
