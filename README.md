# Aegis Protocol - Solana Student Hackathon Fall 2025

> **Aegis Protocol** é uma plataforma de segurança on-chain para agentes AI na Solana, combinando vaults seguros, AMM (Automated Market Maker) e integração de oráculos para proteção contra slippage e manipulação de preços.

## 🎯 Visão

O Aegis Protocol revoluciona a interação de agentes AI com DeFi na Solana, oferecendo:
- **Vaults Seguros**: Controle granular de gastos com aprovação humana para transações grandes
- **AMM Integrado**: Sistema de troca de tokens com proteção contra slippage via oráculos
- **Segurança Enterprise**: Validações rigorosas seguindo melhores práticas Solana
- **UX Otimizada**: Interface intuitiva focada na experiência do usuário

## 🚀 Funcionalidades

### Vaults Inteligentes
- ✅ Criação de vaults com políticas configuráveis
- ✅ Controle de gastos diários e limites por transação
- ✅ Sistema de aprovação para transações grandes
- ✅ Suporte a múltiplos programas autorizados

### AMM (Automated Market Maker)
- ✅ Pools de liquidez com fórmula constant-product
- ✅ Taxas configuráveis por pool
- ✅ Sistema de LP tokens
- ✅ Swaps diretos entre tokens

### Integração de Oráculos
- ✅ Suporte a oráculos Pyth e manuais
- ✅ Proteção contra slippage em tempo real
- ✅ Cálculo preciso de preços com impacto
- ✅ Validação de freshness de dados

### Frontend Moderno
- ✅ Conexão nativa com Phantom Wallet
- ✅ Interface responsiva com Tailwind CSS
- ✅ Seleção inteligente de tokens disponíveis
- ✅ Cotações em tempo real
- ✅ Estatísticas de pools ao vivo

## 🛠️ Stack Tecnológico

- **Blockchain**: Solana (Anchor Framework)
- **Frontend**: Next.js 14 + React + TypeScript
- **Wallet**: Phantom + Solana Wallet Adapter
- **Styling**: Tailwind CSS
- **Oráculos**: Pyth Network + Manual feeds
- **Deploy**: Devnet/Mainnet ready

## 📦 Instalação e Uso

### 1. Pré-requisitos
```bash
# Instalar dependências
npm install -g @solana/cli
npm install -g anchor-cli
```

### 2. Clonagem e Setup
```bash
git clone <repository-url>
cd aegis-protocol

# Instalar dependências do programa
cd aegis-protocol/program
npm install

# Instalar dependências do SDK
cd ../sdk
npm install

# Instalar dependências do frontend
cd ../aegis-frontend
npm install
```

### 3. Deploy do Programa (Devnet)
```bash
cd aegis-protocol/program
anchor build
anchor deploy --provider.cluster devnet
```

### 4. Configuração do Frontend
```bash
cd aegis-frontend
cp env.local.example .env.local
# Edite .env.local com seu RPC endpoint e program ID
```

### 5. Executar Frontend
```bash
npm run dev
```

### 6. Uso Básico

#### Criar um Vault
1. Conecte sua Phantom Wallet
2. Configure limites de gasto diário
3. Adicione programas autorizados
4. Deposite SOL para começar

#### Criar um Pool AMM
1. Escolha dois tokens (devem existir na devnet)
2. Defina taxa de fee (ex: 0.3%)
3. Adicione liquidez inicial
4. Receba LP tokens

#### Executar Swaps
1. Selecione tokens disponíveis nos pools
2. Digite quantidade desejada
3. Configure slippage tolerance
4. Execute o swap

## 🔐 Segurança

O Aegis Protocol implementa múltiplas camadas de segurança:

### On-Chain Security
- ✅ Validação rigorosa de ownership (`is_owned_by`)
- ✅ Aritmética verificada (overflow/underflow protection)
- ✅ PDAs seguros para contas derivadas
- ✅ Validação de Cross-Program Invocations
- ✅ Checks de tamanho de conta e seeds

### Oracle Security
- ✅ Validação de staleness de preços
- ✅ Suporte a múltiplas fontes de oráculo
- ✅ Cálculo de impacto no preço
- ✅ Slippage protection

### Frontend Security
- ✅ Conexão segura com wallets
- ✅ Validação de inputs
- ✅ Error handling robusto
- ✅ UX segura para transações

## 📊 Arquitetura

```
Aegis Protocol
├── Program (Rust/Anchor)
│   ├── Vaults - Controle de gastos AI
│   ├── AMM - Automated Market Maker
│   ├── Oracles - Integração de preços
│   └── Validation - Segurança on-chain
├── SDK (TypeScript)
│   ├── AegisClient - Interface high-level
│   ├── TypeScript types - Type safety
│   └── Event system - Real-time updates
└── Frontend (Next.js)
    ├── Swap Interface - Troca de tokens
    ├── Pool Management - Gestão de liquidez
    ├── Wallet Integration - Conexão Phantom
    └── Analytics - Estatísticas de pools
```

## 🎓 Hackathon Focus

Este projeto foi desenvolvido especificamente para o **Solana Student Hackathon Fall 2025**, atendendo aos critérios:

- ✅ **Inovação**: Sistema único de segurança para agentes AI
- ✅ **Open-source**: Todo código disponível publicamente
- ✅ **Deploy-ready**: Funciona em devnet/mainnet
- ✅ **Demo-ready**: Vídeo demo profissional preparado
- ✅ **Stack oficial**: Usa Anchor Framework e melhores práticas Solana

## 📈 Roadmap

### Phase 1 (Hackathon) ✅
- Vaults seguros com políticas configuráveis
- AMM básico com constant-product formula
- Integração de oráculos manuais
- Frontend funcional com Phantom

### Phase 2 (Próximas melhorias)
- Integração completa com Pyth Network
- Governance para parâmetros de pool
- Analytics avançados de yield
- Mobile app companion

### Phase 3 (Expansão)
- Cross-chain liquidity
- Advanced order types (limit orders, TWAP)
- Risk management automatizado
- Institutional-grade features

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença Apache 2.0 - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Contato

- **Email**: seu-email@exemplo.com
- **Discord**: SeuDiscord#1234
- **Twitter**: @SeuTwitter

---

**Desenvolvido com ❤️ para o Solana Student Hackathon Fall 2025**

*Construindo o futuro da DeFi segura para agentes AI na Solana* 🚀