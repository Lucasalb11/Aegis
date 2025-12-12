# 🚀 Guia de Deploy - Aegis Protocol

Este guia detalha como fazer deploy do Aegis Protocol em diferentes ambientes.

## 📋 Pré-requisitos

- Node.js ≥18.0.0
- Solana CLI ≥1.16.0
- Anchor CLI ≥0.30.0
- Conta Solana com saldo suficiente (para devnet: ~2 SOL)

## 🔧 Configuração Inicial

### 1. Clonagem e Instalação

```bash
git clone <repository-url>
cd aegis-protocol

# Instalar dependências
npm install
```

### 2. Configuração da Carteira

```bash
# Criar carteira Solana (ou usar existente)
solana-keygen new --outfile ~/.config/solana/id.json

# Verificar endereço
solana address

# Airdrop na devnet (se necessário)
solana airdrop 2
```

### 3. Configuração do Cluster

```bash
# Para devnet
solana config set --url https://api.devnet.solana.com

# Verificar configuração
solana config get
```

## 🏗️ Deploy do Programa

### Opção 1: Deploy Manual (Recomendado para Desenvolvimento)

```bash
cd program

# Build do programa
anchor build

# Deploy para devnet
anchor deploy --provider.cluster devnet

# Nota: O programa será deployado com o ID definido em Anchor.toml
# Program ID: AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu
```

### Opção 2: Deploy Automatizado

```bash
# Usar script de deploy
npm run deploy:devnet

# Ou manualmente:
cd program
anchor build && anchor deploy
```

### Verificação do Deploy

```bash
# Verificar se o programa foi deployado
solana program show AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu

# Ou via Explorer:
# https://explorer.solana.com/address/AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu?cluster=devnet
```

## 📦 Build e Publicação do SDK

### Build do SDK

```bash
cd sdk

# Instalar dependências
npm install

# Build
npm run build

# Testar
npm test
```

### Publicação no NPM (Opcional)

```bash
# Login no NPM
npm login

# Publicar
npm publish

# Verificar
npm view @aegis/sdk
```

## 🌐 Deploy do Frontend

### Build do Frontend

```bash
cd app

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Editar .env.local com:
# NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
# NEXT_PUBLIC_PROGRAM_ID=AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu
# NEXT_PUBLIC_CLUSTER=devnet

# Build
npm run build
```

### Deploy para Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Ou para preview
vercel
```

### Deploy para Netlify

```bash
# Build otimizado para static
npm run export

# Deploy via Netlify CLI
netlify deploy --prod --dir=out
```

## 🔄 Atualização do Programa

### Quando houver mudanças no código:

```bash
cd program

# Build
anchor build

# Upgrade (mantém o mesmo program ID)
anchor upgrade --provider.cluster devnet target/deploy/aegis_protocol.so

# Verificar upgrade
solana program show AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu
```

## 🧪 Testes Pós-Deploy

### Testes Automatizados

```bash
# Testes do programa
cd program && anchor test

# Testes do SDK
cd ../sdk && npm test

# Testes E2E (se implementados)
cd ../app && npm run test:e2e
```

### Testes Manuais

1. **Acesse o frontend**: `http://localhost:3000`
2. **Conecte uma carteira** (Phantom/Solflare)
3. **Teste funcionalidades**:
   - Criar pool AMM
   - Adicionar liquidez
   - Fazer swap
   - Verificar saldos

## 🚨 Troubleshooting

### Erro: "Program build failed"

```bash
# Limpar cache do Anchor
anchor clean

# Verificar Rust toolchain
rustc --version
cargo --version

# Rebuild
anchor build
```

### Erro: "Insufficient funds"

```bash
# Airdrop mais SOL na devnet
solana airdrop 5

# Verificar saldo
solana balance
```

### Erro: "Program account not found"

```bash
# Verificar se o programa foi deployado corretamente
solana program show <PROGRAM_ID>

# Redeploy se necessário
anchor deploy
```

## 📊 Monitoramento

### Logs do Programa

```bash
# Ver transações recentes do programa
solana program show --logs AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu
```

### Métricas do Frontend

- Verificar console do browser para erros
- Monitorar performance no Lighthouse
- Verificar conectividade da carteira

## 🔒 Segurança Pós-Deploy

### Verificações Essenciais

1. **Program ID correto** no frontend
2. **RPC URL correto** configurado
3. **Carteiras suportadas** funcionando
4. **Limites de transação** adequados
5. **Error handling** implementado

### Backup

```bash
# Backup das chaves
cp ~/.config/solana/id.json ~/.config/solana/id.json.backup

# Backup do código
git tag v1.0.0-deployed
```

## 📞 Suporte

Para problemas específicos:

1. Verifique os logs detalhados
2. Compare com a documentação
3. Abra issue no repositório
4. Entre em contato com a equipe

---

**Deploy concluído com sucesso!** 🎉

O Aegis Protocol agora está ativo na Solana Devnet e pronto para uso.


