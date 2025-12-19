import { NextRequest, NextResponse } from 'next/server';
import { canClaim, getCooldownHours } from '@/src/lib/faucetStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const status = canClaim(wallet);

    return NextResponse.json({
      canClaim: status.canClaim,
      nextClaimTime: status.nextClaimTime?.toISOString(),
      lastClaim: status.lastClaim?.toISOString(),
      cooldownHours: getCooldownHours(),
      message: status.canClaim
        ? 'You can claim tokens now!'
        : `Next claim available at ${status.nextClaimTime?.toLocaleString()}`,
    });
  } catch (error: any) {
    console.error('[Faucet Status] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
