//! Error codes for the Guardrails program.
//!
//! Each variant maps to a unique error code (starting at 6000 per Anchor
//! convention). These are returned via `require!()` in instruction handlers
//! and decoded by the SDK and server using the IDL.

use anchor_lang::prelude::*;

#[error_code]
pub enum GuardrailsError {
    #[msg("Policy is paused by owner or monitor")]
    PolicyPaused,
    #[msg("Session has expired")]
    SessionExpired,
    #[msg("Target program is not on the allow-list")]
    ProgramNotWhitelisted,
    #[msg("Transaction amount exceeds per-tx limit")]
    AmountExceedsLimit,
    #[msg("Daily budget exceeded")]
    DailyBudgetExceeded,
    #[msg("Caller is not an authorized monitor or owner")]
    UnauthorizedPauser,
    #[msg("Only owner can resume a paused agent")]
    ResumeRequiresOwner,
    #[msg("Escalation required — proposal created on Squads")]
    EscalatedToMultisig,
}
