use anchor_lang::prelude::*;
use crate::state::Pool;

pub fn vault_signer_seeds(owner: &Pubkey, bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"vault".to_vec(),
        owner.to_bytes().to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn pool_signer_seeds(pool: &Pool) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"pool".to_vec(),
        pool.mint_a.to_bytes().to_vec(),
        pool.mint_b.to_bytes().to_vec(),
        vec![pool.bump],
    ];
    (pool.bump, seeds)
}

pub fn pool_vault_seeds(pool: &Pubkey, mint: &Pubkey, bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"pool_vault".to_vec(),
        pool.to_bytes().to_vec(),
        mint.to_bytes().to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn lp_mint_seeds(pool: &Pubkey, bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"lp_mint".to_vec(),
        pool.to_bytes().to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn oracle_seeds(pool: &Pubkey, bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"oracle".to_vec(),
        pool.to_bytes().to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn reward_minter_seeds(bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"reward_minter".to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn emission_vault_seeds(bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"emission_vault".to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn lm_vault_seeds(bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"lm_vault".to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn team_vault_seeds(bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"team_vault".to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn ecosystem_vault_seeds(bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"ecosystem_vault".to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}

pub fn team_vesting_seeds(bump: u8) -> (u8, Vec<Vec<u8>>) {
    let seeds = vec![
        b"team_vesting".to_vec(),
        vec![bump],
    ];
    (bump, seeds)
}