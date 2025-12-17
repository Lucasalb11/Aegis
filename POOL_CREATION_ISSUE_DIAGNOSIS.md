# Diagnóstico do Problema de Criação de Pools

## 🔍 Problema Identificado

Ao testar a criação de pools no Aegis Protocol, foram identificados os seguintes problemas:

### 1. **Mismatch de Program ID**

O erro principal encontrado foi:
```
AnchorError occurred. Error Code: DeclaredProgramIdMismatch. Error Number: 4100. 
Error Message: The declared program id does not match the actual program id.
```

#### Causa Raiz

Existem **múltiplos Program IDs** conflitantes no código:

1. **No `lib.rs`**: `AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu`
2. **Keypair gerado pelo Anchor**: `FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9`
3. **No IDL atual**: `FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9`
4. **Programa deployado em devnet**: `AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu`

### 2. **Discriminators Incorretos no SDK**

O SDK estava criando instruções manualmente com discriminators incorretos:

**Discriminators Corretos (do IDL)**:
- `initializePool`: `[95, 180, 10, 172, 84, 174, 232, 40]`
- `addLiquidity`: `[181, 157, 89, 67, 143, 182, 52, 72]`
- `swap`: `[248, 198, 158, 145, 225, 117, 135, 200]`

**O SDK estava usando** discriminators incorretos manualmente construídos.

### 3. **Serialização Incorreta dos Argumentos**

As instruções estavam sendo serializadas incorretamente:
- Ordem dos bytes estava errada
- Tipos de dados não correspondiam ao esperado pelo programa

## ✅ Correções Aplicadas

### 1. Correção dos Discriminators no SDK

Arquivo: `aegis-protocol/sdk/src/pool.ts`

**Antes**:
```typescript
const data = Buffer.alloc(3);
data.writeUInt16LE(feeBps, 0);
data.writeUInt8(0, 2); // instruction discriminator INCORRETO
```

**Depois**:
```typescript
// Discriminator correto do IDL para initializePool
const discriminator = Buffer.from([95, 180, 10, 172, 84, 174, 232, 40]);

// Serializar o argumento feeBps (u16 em little-endian)
const feeBpsBuffer = Buffer.alloc(2);
feeBpsBuffer.writeUInt16LE(feeBps, 0);

// Combinar discriminator + args
const data = Buffer.concat([discriminator, feeBpsBuffer]);
```

### 2. Correção da Serialização de U64

Para `addLiquidity` e `swap`, foi corrigida a serialização de valores u64:

```typescript
// Correto: usar writeBigUInt64LE para u64
const amountABuffer = Buffer.alloc(8);
amountABuffer.writeBigUInt64LE(BigInt(params.amountA.toString()));
```

### 3. Correção dos Accounts na Instrução Swap

Adicionados os mints source e destination conforme o IDL:

```typescript
keys: [
  { pubkey: this.aegis.wallet.publicKey, isSigner: true, isWritable: true },
  { pubkey: this.info.address, isSigner: false, isWritable: true },
  { pubkey: this.info.vaultA, isSigner: false, isWritable: true },
  { pubkey: this.info.vaultB, isSigner: false, isWritable: true },
  { pubkey: userSource, isSigner: false, isWritable: true },
  { pubkey: userDestination, isSigner: false, isWritable: true },
  { pubkey: sourceMint, isSigner: false, isWritable: false }, // Adicionado
  { pubkey: destinationMint, isSigner: false, isWritable: false }, // Adicionado
  { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
]
```

## 🔧 Scripts de Teste Criados

Para facilitar o diagnóstico, foram criados dois scripts de teste:

### 1. `test-create-pools.ts`

Script completo usando Anchor que:
- Cria tokens de teste
- Cria múltiplas pools
- Adiciona liquidez inicial
- Verifica o estado das pools

**Localização**: `aegis-protocol/sdk/scripts/test-create-pools.ts`

**Executar**:
```bash
cd aegis-protocol/sdk
npm run test:create-pools
```

### 2. `test-sdk-create-pool.ts`

Script que usa apenas o SDK Aegis (sem Anchor) para:
- Isolar problemas específicos do SDK
- Testar a criação de pools de forma simplificada
- Validar os métodos do SDK

**Localização**: `aegis-protocol/sdk/scripts/test-sdk-create-pool.ts`

**Executar**:
```bash
cd aegis-protocol/sdk  
npm run test:sdk-pool
```

## 🚀 Próximos Passos Necessários

Para resolver completamente o problema, é necessário:

### 1. **Sincronizar o Program ID**

Escolher UM Program ID e usá-lo em todos os lugares:

**Opção A: Usar o ID existente no devnet**
```bash
# No lib.rs, manter:
declare_id!("AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu");

# Regenerar o IDL
cd aegis-protocol/program
anchor build
cp target/idl/aegis_protocol.json ../sdk/src/idl.json
```

**Opção B: Usar o ID gerado pelo Anchor**
```rust
// No lib.rs, atualizar para:
declare_id!("FqGarB7xanZe2PWXxsFdxMgkYF1kR4q6E1VSSWsTgBc9");
```

### 2. **Re-deploy do Programa**

Depois de sincronizar o Program ID:

```bash
cd aegis-protocol/program

# Buildar
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# Verificar
solana program show <PROGRAM_ID> --url devnet
```

### 3. **Atualizar o Frontend**

O frontend precisa usar o SDK corrigido. Verificar:

- O arquivo `aegis-frontend/src/hooks/usePools.ts` está usando o SDK correto?
- As dependências estão atualizadas?
- O Program ID no frontend corresponde ao deployado?

### 4. **Testar o Fluxo Completo**

1. Criar pool via SDK (scripts de teste)
2. Verificar pool criada via CLI/Explorer
3. Testar criação via frontend
4. Adicionar liquidez
5. Fazer swap

## 📋 Checklist de Verificação

- [ ] Program ID sincronizado em todos os arquivos
- [ ] Programa re-deployado no devnet
- [ ] IDL atualizado no SDK
- [ ] SDK testado com scripts
- [ ] Frontend atualizado com novo SDK
- [ ] Teste end-to-end completo

## 🐛 Como Testar o Problema

### Teste 1: Verificar Program ID
```bash
# No código
cd aegis-protocol/program
grep "declare_id" src/lib.rs

# No devnet
solana program show AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu --url devnet
```

### Teste 2: Tentar Criar Pool
```bash
cd aegis-protocol/sdk
npm run test:sdk-pool
```

### Teste 3: Verificar Pools Existentes
```bash
# Via Anchor (se o programa estiver deployado)
solana program dump AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu /tmp/aegis.so --url devnet
```

## 💡 Recomendações

1. **Use Anchor CLI para deployment**: É mais confiável que deploys manuais
2. **Mantenha o IDL sincronizado**: Copie sempre após o build
3. **Teste localmente primeiro**: Use `anchor test` antes de deployar
4. **Documente o Program ID**: Mantenha um registro centralizado

## 🔗 Arquivos Modificados

- ✅ `aegis-protocol/sdk/src/pool.ts` - Discriminators e serialização corrigidos
- ✅ `aegis-protocol/sdk/package.json` - Novos scripts adicionados
- ✅ `aegis-protocol/sdk/scripts/test-create-pools.ts` - Novo script de teste
- ✅ `aegis-protocol/sdk/scripts/test-sdk-create-pool.ts` - Novo script SDK

## 📖 Referências

- [Anchor IDL Specification](https://www.anchor-lang.com/docs/idl)
- [Solana Program Deployment](https://docs.solana.com/cli/deploy-a-program)
- [Discriminators em Anchor](https://book.anchor-lang.com/anchor_bts/discriminator.html)
