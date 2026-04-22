//! escalate_to_squads instruction handler — STUB for MVP.
//!
//! Squads escalation is already handled inside `guarded_execute` step 8:
//! when `amount > escalation_threshold` and `squads_multisig` is set, the
//! program emits `EscalatedToSquads` and returns `EscalatedToMultisig` error.
//! The server catches the error and creates the Squads proposal off-chain.
//!
//! This standalone instruction exists for IDL completeness and future
//! on-chain Squads CPI support. Currently a no-op.

use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct EscalateToSquads {}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// No-op stub. Escalation is handled inside guarded_execute.
pub fn handler(_ctx: Context<EscalateToSquads>) -> Result<()> {
    msg!("escalate_to_squads: no-op — escalation handled in guarded_execute");
    Ok(())
}
