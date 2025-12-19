/**
 * Simple in-memory store for faucet rate limiting
 * In production, use Redis or a database
 */

const COOLDOWN_HOURS = 24;

// In-memory rate limiting store
const claimHistory: Map<string, Date> = new Map();

export interface ClaimStatus {
  canClaim: boolean;
  nextClaimTime?: Date;
  lastClaim?: Date;
}

export function canClaim(wallet: string): ClaimStatus {
  const lastClaim = claimHistory.get(wallet);
  
  if (!lastClaim) {
    return { canClaim: true };
  }
  
  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
  const nextClaimTime = new Date(lastClaim.getTime() + cooldownMs);
  
  if (new Date() >= nextClaimTime) {
    return { canClaim: true, lastClaim };
  }
  
  return { canClaim: false, nextClaimTime, lastClaim };
}

export function recordClaim(wallet: string) {
  claimHistory.set(wallet, new Date());
}

export function getCooldownHours() {
  return COOLDOWN_HOURS;
}
