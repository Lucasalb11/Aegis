#!/bin/bash

# Script de deploy com retry automático para contornar problemas de rede
# Uso: ./scripts/deploy-with-retry.sh

set -e

echo "🚀 Deploy Automático com Retry - Aegis Protocol"
echo "================================================"
echo ""

PROGRAM_ID="FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9"
MAX_ATTEMPTS=20
DELAY=10

echo "📋 Program ID: $PROGRAM_ID"
echo "🔄 Máximo de tentativas: $MAX_ATTEMPTS"
echo "⏱️  Delay entre tentativas: ${DELAY}s"
echo ""

# Verificar se o programa foi compilado
if [ ! -f "target/deploy/aegis_protocol.so" ]; then
    echo "❌ Binário não encontrado! Execute 'anchor build' primeiro."
    exit 1
fi

echo "✅ Binário encontrado: $(ls -lh target/deploy/aegis_protocol.so | awk '{print $5}')"
echo ""

# Verificar saldo
BALANCE=$(solana balance --url devnet | awk '{print $1}')
echo "💰 Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 1" | bc -l) )); then
    echo "⚠️  Saldo baixo! Recomendado: pelo menos 5 SOL"
    echo "Execute: solana airdrop 2 --url devnet"
    read -p "Continuar mesmo assim? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🔄 Iniciando deploy com retry..."
echo ""

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 Tentativa $i de $MAX_ATTEMPTS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if solana program deploy \
        target/deploy/aegis_protocol.so \
        --program-id $PROGRAM_ID \
        --url devnet \
        --upgrade-authority ~/.config/solana/id.json \
        --max-sign-attempts 1000 \
        --with-compute-unit-price 1000; then
        
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ DEPLOY BEM-SUCEDIDO!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "📋 Verificando programa..."
        solana program show $PROGRAM_ID --url devnet
        echo ""
        echo "🎉 Programa deployado com sucesso na tentativa $i!"
        echo ""
        echo "🧪 Próximo passo: Testar criação de pools"
        echo "   cd ../sdk && npm run test:sdk-pool"
        echo ""
        exit 0
    fi
    
    echo ""
    echo "❌ Tentativa $i falhou"
    
    # Limpar buffers intermediários que podem ter ficado
    echo "🧹 Limpando buffers intermediários..."
    solana program close --buffers --url devnet 2>/dev/null || true
    
    if [ $i -lt $MAX_ATTEMPTS ]; then
        echo "⏳ Aguardando ${DELAY}s antes da próxima tentativa..."
        sleep $DELAY
        echo ""
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "❌ DEPLOY FALHOU APÓS $MAX_ATTEMPTS TENTATIVAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Possíveis soluções:"
echo ""
echo "1. Usar um RPC privado (recomendado):"
echo "   export ANCHOR_PROVIDER_URL='https://devnet.genesysgo.net'"
echo "   ./scripts/deploy-with-retry.sh"
echo ""
echo "2. Tentar novamente mais tarde (rede devnet pode estar congestionada)"
echo ""
echo "3. Usar localnet para desenvolvimento:"
echo "   solana-test-validator"
echo "   anchor deploy"
echo ""
echo "4. Aumentar o limite de gas:"
echo "   solana config set --url devnet"
echo "   solana airdrop 5"
echo "   ./scripts/deploy-with-retry.sh"
echo ""
exit 1
