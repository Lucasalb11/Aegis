use anchor_lang::prelude::*;
use crate::state::Pool;

pub fn vault_signer_seeds(owner: &Pubkey, bump: u8) -> Vec<u8> {
    let mut seeds = Vec::new();
    seeds.extend_from_slice(b"vault");
    seeds.extend_from_slice(owner.as_ref());
    seeds.push(bump);
    seeds
}

pub fn pool_signer_seeds(pool: &Pool) -> Vec<u8> {
    let mut seeds = Vec::new();
    seeds.extend_from_slice(b"pool");
    seeds.extend_from_slice(pool.mint_a.as_ref());
    seeds.extend_from_slice(pool.mint_b.as_ref());
    seeds.push(pool.bump);
    seeds
}

pub fn pool_vault_seeds(pool: &Pubkey, mint: &Pubkey, bump: u8) -> Vec<u8> {
    let mut seeds = Vec::new();
    seeds.extend_from_slice(b"pool_vault");
    seeds.extend_from_slice(pool.as_ref());
    seeds.extend_from_slice(mint.as_ref());
    seeds.push(bump);
    seeds
}

pub fn lp_mint_seeds(pool: &Pubkey, bump: u8) -> Vec<u8> {
    let mut seeds = Vec::new();
    seeds.extend_from_slice(b"lp_mint");
    seeds.extend_from_slice(pool.as_ref());
    seeds.push(bump);
    seeds
}

pub fn oracle_seeds(pool: &Pubkey, bump: u8) -> Vec<u8> {
    let mut seeds = Vec::new();
    seeds.extend_from_slice(b"oracle");
    seeds.extend_from_slice(pool.as_ref());
    seeds.push(bump);
    seeds
}