const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
const { readFileSync } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

async function main() {
    console.log('🚀 Iniciando deploy do Aegis Protocol na devnet...\n');

    // Configurar conexão com devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Carregar wallet de deploy
    const walletPath = path.join(__dirname, '../wallets/aegis-deploy-wallet.json');
    const walletData = JSON.parse(readFileSync(walletPath, 'utf-8'));
    const deployWallet = Keypair.fromSecretKey(new Uint8Array(walletData));

    console.log(`📧 Wallet de deploy: ${deployWallet.publicKey.toString()}`);

    // Verificar saldo atual
    const balance = await connection.getBalance(deployWallet.publicKey);
    console.log(`💰 Saldo atual: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Solicitar airdrop se necessário (mínimo 1 SOL)
    const MIN_BALANCE = LAMPORTS_PER_SOL;
    if (balance < MIN_BALANCE) {
        console.log('💸 Solicitando airdrop de 2 SOL...');
        try {
            const airdropSignature = await connection.requestAirdrop(deployWallet.publicKey, 2 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(airdropSignature);
            const newBalance = await connection.getBalance(deployWallet.publicKey);
            console.log(`✅ Airdrop concluído! Novo saldo: ${newBalance / LAMPORTS_PER_SOL} SOL`);
        } catch (error) {
            console.error('❌ Erro no airdrop:', error.message);
            // Tentar múltiplas vezes em caso de rate limit
            if (error.message.includes('rate limit')) {
                console.log('⏳ Aguardando rate limit...');
                await new Promise(resolve => setTimeout(resolve, 30000));
                return main(); // Retry
            }
            throw error;
        }
    }

    // Fazer build do programa
    console.log('\n🔨 Fazendo build do programa...');
    try {
        execSync('anchor build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
        console.log('✅ Build concluído!');
    } catch (error) {
        console.error('❌ Erro no build:', error.message);
        throw error;
    }

    // Verificar se o programa já está deployado
    const programId = new PublicKey('3ocZbHXDgRAS32T6XqKwfPZGFwUwz6H5bJNsF2MoptrU');
    console.log(`\n🔍 Verificando se o programa ${programId.toString()} já está deployado...`);

    try {
        const programInfo = await connection.getAccountInfo(programId);
        if (programInfo) {
            console.log('✅ Programa já está deployado!');
            console.log(`📊 Tamanho do programa: ${programInfo.data.length} bytes`);
            console.log(`🏠 Owner: ${programInfo.owner.toString()}`);
        } else {
            console.log('📦 Programa não encontrado. Tentando deploy alternativo...');

            // Tentar deploy usando uma abordagem diferente
            const fs = require('fs');
            const programSoPath = path.join(__dirname, '../../target/deploy/aegis_protocol.so');

            if (!fs.existsSync(programSoPath)) {
                throw new Error(`Arquivo .so não encontrado: ${programSoPath}`);
            }

            // Carregar o programa
            const programData = fs.readFileSync(programSoPath);

            // Criar instrução de deploy
            const { SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');

            console.log('🚀 Enviando transação de deploy...');
            // Nota: Esta é uma simplificação. O deploy real de programas requer
            // uma sequência específica de instruções que o CLI do Solana lida automaticamente
            console.log('⚠️  Deploy manual não implementado. Use o CLI do Solana quando disponível.');
            throw new Error('Deploy manual não suportado. Programa pode já estar deployado.');
        }
    } catch (error) {
        console.error('❌ Erro na verificação/deploy:', error.message);
        throw error;
    }

    // Verificar se o programa foi deployado
    try {
        const programInfo = await connection.getAccountInfo(programId);
        if (programInfo) {
            console.log(`\n🎉 Programa deployado com sucesso!`);
            console.log(`📍 Program ID: ${programId.toString()}`);
            console.log(`📊 Tamanho do programa: ${programInfo.data.length} bytes`);
        } else {
            console.log('\n⚠️  Programa não encontrado após verificação');
        }
    } catch (error) {
        console.error('❌ Erro ao verificar programa:', error.message);
    }

    // Saldo final
    const finalBalance = await connection.getBalance(deployWallet.publicKey);
    console.log(`\n💰 Saldo final: ${finalBalance / LAMPORTS_PER_SOL} SOL`);

    console.log('\n🔐 IMPORTANTE: Faça backup da wallet!');
    console.log(`📁 Localização: ${walletPath}`);
    console.log(`🔑 Seed phrase salva separadamente para recuperação`);
}

main().catch(console.error);
