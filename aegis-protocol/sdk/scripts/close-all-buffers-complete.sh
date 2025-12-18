#!/bin/bash

UPGRADE_AUTHORITY="EwCiSnQEJTSZV4B9v4xRkJJFcDDFKA1i8NbyNAmXGm4z"
RPC_URL="https://api.devnet.solana.com"

echo "🔍 Fechando TODOS os buffers conhecidos..."
echo ""

# Lista completa de todos os buffers de tentativas anteriores
BUFFERS=(
  "7XTsSccVmQmaGZVKH4TDBU1pfMqsBQLJvM9YZUEZrQxS"
  "2ABXPWbxfrGyWtDEr31SHZTSXwt7oTqbir6Q13DXnqRR"
  "DwM9Ks5bdKPrebYKW9NWReEF79gK5rDEvYga2cJw1JLL"
  "5NxHvFJ6YzrWMy1ZufHipiqhGY22Y5aHEAith3BkWJ2v"
  "J4KLDzTc5LtAPzxon7eU7669EWpmzysSxeZ743rX5bvk"
  "DJHxg4ZH4XAhNhPYAAcqCm5741NMFwo5vf5FdFyKtHmd"
  "A58vpufAm48e5Zb1iL1MdkTxJmsw1C8tdUq58yDH1k5E"
  "BmrhB1KmqvHYze1ohDLZspEqw26RX7pZgAnmoPed2ixj"
  "3hLLV7zgvhVrsDnCrN81Dn3Bb4NabFLPJSq3wDrhZHbm"
  "DCULzpFyQj6X5G2Z8Yegr9TiL2LicHpATMFrVsaVE3Vx"
  "e2FhwUHQ3KkxzFJw26cZRxwfmqkG76U4r9YmssvkRYS"
  "D4XLggMaWGqyUANn4shEsy1bYX4fY5f6sDEsvH9gLU7E"
  "3R4W6oGKLgdKGpvo7X8yC6ojv88zEaod17iqaY1hDb8c"
  "EepiXNnKgafSFvzbV6cbmxXH3E136ftcfxCzG8HbCC8m"
  "529h9A3QCr9pgDvgRcGfxarBQMYiQ4QsC99F1W5PamYW"
  "Byk2ysBiJtGK8LTihZBJGNUuQvuAErAYVNiKv9f5YoWa"
)

CLOSED=0
RECOVERED=0

for BUFFER in "${BUFFERS[@]}"; do
  echo "🔒 Tentando fechar: $BUFFER..."
  
  OUTPUT=$(solana program close "$BUFFER" --url devnet 2>&1)
  
  if echo "$OUTPUT" | grep -q "Balance:"; then
    BALANCE=$(echo "$OUTPUT" | grep "Balance:" | awk '{print $2}')
    echo "  ✅ Fechado! Recuperado: $BALANCE SOL"
    CLOSED=$((CLOSED + 1))
    # Extrair número do balance
    BALANCE_NUM=$(echo "$BALANCE" | sed 's/SOL//' | xargs)
    RECOVERED=$(echo "$RECOVERED + $BALANCE_NUM" | bc)
  elif echo "$OUTPUT" | grep -q "Unable to find"; then
    echo "  ⏭️  Já foi fechado ou não existe"
  elif echo "$OUTPUT" | grep -q "authority"; then
    echo "  ⚠️  Sem autoridade"
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
echo "SOL recuperado: $RECOVERED SOL"
echo ""

FINAL_BALANCE=$(solana balance "$UPGRADE_AUTHORITY" --url devnet | awk '{print $1}')
echo "💰 Saldo final da upgrade authority: $FINAL_BALANCE SOL"
echo ""

if (( $(echo "$FINAL_BALANCE >= 4.55" | bc -l) )); then
  echo "✅ SOL suficiente para upgrade!"
else
  NEEDED=$(echo "4.55 - $FINAL_BALANCE" | bc -l)
  echo "⚠️  Ainda precisa de $NEEDED SOL"
fi
