//! resume_agent instruction handler.
//!
//! Only the policy owner can resume a paused agent. Monitors are explicitly
//! excluded — this ensures that a human owner must review and approve before
//! an agent resumes operation after a pause.

use anchor_lang::prelude::*;

use crate::errors::GuardrailsError;
use crate::events::AgentResumed;
use crate::state::policy::PermissionPolicy;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct ResumeAgent<'info> {
    /// The policy owner. Must sign. The `has_one = owner` constraint verifies
    /// this signer matches the stored `policy.owner`. Unlike pause_agent,
    /// monitors are NOT allowed to resume.
    pub owner: Signer<'info>,

    /// The PermissionPolicy PDA to resume. Mutable because is_active,
    /// paused_by, and paused_reason fields are cleared.
    #[account(
        mut,
        seeds = [b"policy", policy.owner.as_ref(), policy.agent.as_ref()],
        bump = policy.bump,
        has_one = owner @ GuardrailsError::ResumeRequiresOwner,
    )]
    pub policy: Account<'info, PermissionPolicy>,
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// Resumes a paused agent by re-enabling the policy kill switch.
///
/// Flow:
///   1. Owner-only enforced by Anchor `has_one` constraint
///   2. Set is_active = true, paused_by = None, clear paused_reason
///   3. Emit AgentResumed event
pub fn handler(ctx: Context<ResumeAgent>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    // --- Clear pause state ---
    policy.is_active = true;
    policy.paused_by = None;
    policy.paused_reason = [0u8; 64];

    // --- Emit event ---
    let clock = Clock::get()?;
    emit!(AgentResumed {
        policy: policy.key(),
        resumed_by: ctx.accounts.owner.key(),
        timestamp: clock.unix_timestamp,
    });

    msg!("Agent resumed by owner {}", ctx.accounts.owner.key());

    Ok(())
}
