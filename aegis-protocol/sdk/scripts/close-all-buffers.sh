#!/bin/bash

UPGRADE_AUTHORITY="EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z"
RPC_URL="https://api.devnet.solana.com"

echo "🔍 Procurando buffers abertos da upgrade authority..."
echo ""

# Lista de buffers conhecidos (adicionar mais conforme necessário)
BUFFERS=(
  "2hAWrZGNfXvno314EaYM6J2DkXmLet8SuDXcH6NsWeFU"
  "DauuoanLHK7eY5CroCHmS3TrkAoKYVotsRb4jCUujqGg"
  "BBUmRRQxuZQ9aLmxXmLKFun5YBuweXs2rL68g66s4ykx"
  "AC4UcMej1a1gpD2y663uvEWHKFC4MUKW3EM7uSBPKiAR"
  "Aph1dU5FGk2fyQstHA54zw5Mq6VNTKeao5auXdjusiRE"
  "AJYn6bjp4MeCRCsy97fFYu5Urk4dRhSugMju6wQq8tDW"
  "AiNeGvrvxkgjue2GFRWNJyG2oBqTkQEuh7rN3tgtLBwP"
  "HWwCWJQ3wvszPgKssMKQ9PtitG5Rmnnn5zmXxq7hQt7E"
  "AexER8SoGHw6Boe81MHNCqaUF1YWmCXhwmepw5ZYEYY6"
  "vHPuYMKkayu17f7RoSZbLwBqAsYL6EzmDYfRCbTE6Wu"
  "DzgJo1xPk1H3ep757A9YQc9VVJuQY9fFcsAUAQe4tATk"
  "C7fZMnz4ZQPTZVYy24YrpTFL4svV562tNAtb6hxAQzyP"
  "F7u6VKF72JA5XB6MrfdfLGJR593hg8gjqU6qpi2qbzLi"
  "J3tEHV2TvD5WFhrE2r3VoMni97WoHSJM3B5rSBvnxorc"
  "4WzV7GAauChtEMwoWJvYkTunKRtGeV5rkmCK5RucLqgA"
  "DdL8F54Atjs1jiRipLjWwjwx5kFTJBoxQ9cy4SdWjHz4"
)

CLOSED=0
TOTAL_RECOVERED=0

for BUFFER in "${BUFFERS[@]}"; do
  echo "🔒 Tentando fechar buffer: $BUFFER..."
  
  OUTPUT=$(solana program close "$BUFFER" --url devnet 2>&1)
  
  if echo "$OUTPUT" | grep -q "Balance:"; then
    BALANCE=$(echo "$OUTPUT" | grep "Balance:" | awk '{print $2}')
    echo "  ✅ Fechado! Recuperado: $BALANCE SOL"
    CLOSED=$((CLOSED + 1))
  elif echo "$OUTPUT" | grep -q "Unable to find"; then
    echo "  ⏭️  Buffer já foi fechado ou não existe"
  elif echo "$OUTPUT" | grep -q "authority"; then
    echo "  ⚠️  Buffer não pertence à upgrade authority"
  else
    ERROR_MSG=$(echo "$OUTPUT" | head -1)
    if [ -n "$ERROR_MSG" ]; then
      echo "  ❌ Erro: $ERROR_MSG"
    fi
  fi
  
  sleep 0.5
done

echo ""
echo "============================================================"
echo "📊 RESUMO"
echo "============================================================"
echo "Buffers fechados: $CLOSED"
echo ""

FINAL_BALANCE=$(solana balance "$UPGRADE_AUTHORITY" --url devnet | awk '{print $1}')
echo "💰 Saldo final da upgrade authority: $FINAL_BALANCE SOL"
