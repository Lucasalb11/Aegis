use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo, Transfer};

use crate::{errors::ErrorCode, validation};

pub fn transfer_signed<'info>(
    token_program: AccountInfo<'info>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    validation::assert_positive(amount)?;
    token::transfer(
        CpiContext::new_with_signer(
            token_program,
            Transfer {
                from,
                to,
                authority,
            },
            signer_seeds,
        ),
        amount,
    )
}

pub fn mint_to_signed<'info>(
    token_program: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    validation::assert_positive(amount)?;
    token::mint_to(
        CpiContext::new_with_signer(
            token_program,
            MintTo { mint, to, authority },
            signer_seeds,
        ),
        amount,
    )
}

pub fn burn<'info>(
    token_program: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    from: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    validation::assert_positive(amount)?;
    token::burn(
        CpiContext::new(
            token_program,
            Burn {
                mint,
                from,
                authority,
            },
        ),
        amount,
    )
}