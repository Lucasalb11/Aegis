# ⚠️ PROBLEMA CRÍTICO: Program ID Mismatch

## 🔍 DIAGNÓSTICO

O erro `DeclaredProgramIdMismatch` indica que há uma incompatibilidade entre:
- O program ID no código Rust (`lib.rs`)
- O program ID deployado na devnet
- O program ID usado nas instruções

## 📋 PROGRAM IDs ENCONTRADOS

1. **No código (`lib.rs`)**: `FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9`
2. **Deployado na devnet**: `AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu` ✅ EXISTE
3. **No IDL**: `FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9`

## 🎯 SOLUÇÃO

**OPÇÃO 1: Usar o program ID deployado** (RECOMENDADO)
- Atualizar `.env.local` para usar: `AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu`
- Mas isso pode não funcionar se o código Rust ainda tem o outro ID

**OPÇÃO 2: Re-deployar com o ID correto**
- Atualizar `lib.rs` para usar o ID que queremos
- Re-deployar o programa

**OPÇÃO 3: Verificar qual programa está realmente funcionando**
- Testar criar pool com ambos os IDs
- Ver qual funciona

## 💡 RECOMENDAÇÃO IMEDIATA

Como você quer criar pools AGORA, vamos:
1. Verificar qual program ID realmente funciona
2. Usar esse ID para criar as pools
3. Depois podemos sincronizar tudo

**Próximo passo**: Informe qual program ID você quer usar, ou podemos testar ambos.
