import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { canClaim, recordClaim } from '@/src/lib/faucetStore';

// Token configuration
const TOKENS = [
  {
    symbol: 'AEGIS',
    mint: 'GN4CDgz5N3AyoM2pgbzeojaM6n9A3BkMjbXD29Hv53Q9',
    vaultAta: 'F1MAvnqLyanG7paCMd39Q6BfDQQWrD14sqbRreS8Ekgz',
    decimals: 6,
  },
  {
    symbol: 'AERO',
    mint: 'DAWQbsTWz79AApBEWeb4mvjui9XkjprYroKh2gheCoj3',
    vaultAta: 'B3o91sYAGyptgifMTM91yRAiK9K9pqGpSmdjYV2MAePG',
    decimals: 6,
  },
  {
    symbol: 'ABTC',
    mint: '3CDvX4g72rMeS44tNe4EDifYDrq1S2qc7c8ra74tvWzc',
    vaultAta: 'CZsBaiijVA4sWJu23cNY8K6TR9Ru8wrpiYUW6pGxPCcC',
    decimals: 6,
  },
  {
    symbol: 'AUSD',
    mint: 'D14T791rbVoZhiovmostvM9QaRC2tNUmgT9mEF2viys',
    vaultAta: 'GMkUkvEE6VxBVwxhEm4QiBqDANzNk6GEtNorCEFTRgTP',
    decimals: 6,
  },
  {
    symbol: 'ASOL',
    mint: '7LNopo3uG7G9Qz5qcDvdZp1Lh4uGQWpaaLHZzbjvvv15',
    vaultAta: '2XVXXqNV3sv4aeJP8WRBCthhZ8UD8dUTQyYLnSzgNXsG',
    decimals: 6,
  },
];

const TOKENS_PER_REQUEST = 10;

function getTreasuryKeypair(): Keypair | null {
  const secretKeyStr = process.env.FAUCET_TREASURY_SECRET_KEY;
  
  if (!secretKeyStr) {
    console.error('[Faucet] FAUCET_TREASURY_SECRET_KEY not configured');
    return null;
  }
  
  try {
    // Try parsing as JSON array first
    const secretKey = JSON.parse(secretKeyStr);
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } catch {
    try {
      // Try parsing as base58
      const bs58 = require('bs58');
      const secretKey = bs58.decode(secretKeyStr);
      return Keypair.fromSecretKey(secretKey);
    } catch {
      console.error('[Faucet] Failed to parse treasury secret key');
      return null;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, tokens: requestedTokens } = body;

    // Validate wallet address
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    let userPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Check rate limiting
    const claimStatus = canClaim(wallet);
    if (!claimStatus.canClaim) {
      return NextResponse.json(
        {
          error: `Please wait before claiming again`,
          nextClaimTime: claimStatus.nextClaimTime?.toISOString(),
        },
        { status: 429 }
      );
    }

    // Get treasury keypair
    const treasury = getTreasuryKeypair();
    if (!treasury) {
      return NextResponse.json(
        { error: 'Faucet not configured properly' },
        { status: 500 }
      );
    }

    // Connect to Solana
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Filter tokens to claim
    const tokensToSend = requestedTokens && requestedTokens.length > 0
      ? TOKENS.filter(t => requestedTokens.includes(t.symbol))
      : TOKENS;

    if (tokensToSend.length === 0) {
      return NextResponse.json(
        { error: 'No valid tokens selected' },
        { status: 400 }
      );
    }

    const signatures: string[] = [];
    const errors: string[] = [];

    // Process each token
    for (const token of tokensToSend) {
      try {
        const mintPubkey = new PublicKey(token.mint);
        const sourceAta = new PublicKey(token.vaultAta);
        
        // Get or create user's ATA
        const userAta = await getOrCreateAssociatedTokenAccount(
          connection,
          treasury,
          mintPubkey,
          userPubkey
        );

        // Calculate amount with decimals
        const amount = BigInt(TOKENS_PER_REQUEST * Math.pow(10, token.decimals));

        // Create transfer instruction
        const transferIx = createTransferInstruction(
          sourceAta,
          userAta.address,
          treasury.publicKey,
          amount,
          [],
          TOKEN_PROGRAM_ID
        );

        // Create and send transaction
        const transaction = new Transaction().add(transferIx);
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = treasury.publicKey;

        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [treasury],
          { commitment: 'confirmed' }
        );

        signatures.push(signature);
        console.log(`[Faucet] Sent ${TOKENS_PER_REQUEST} ${token.symbol} to ${wallet}: ${signature}`);
      } catch (err: any) {
        console.error(`[Faucet] Failed to send ${token.symbol}:`, err);
        errors.push(`${token.symbol}: ${err.message}`);
      }
    }

    // Record the claim even if some tokens failed
    if (signatures.length > 0) {
      recordClaim(wallet);
    }

    return NextResponse.json({
      success: true,
      signatures,
      tokensReceived: tokensToSend.filter((_, i) => signatures[i]).map(t => t.symbol),
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully sent ${signatures.length}/${tokensToSend.length} tokens`,
    });
  } catch (error: any) {
    console.error('[Faucet] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
