//! pause_agent instruction handler.
//!
//! Allows the policy owner or any authorized monitor to pause an agent by
//! setting `is_active = false` on the PermissionPolicy. Once paused, all
//! `guarded_execute` calls for this policy are rejected with `PolicyPaused`.
//!
//! Only the owner can resume via `resume_agent` — monitors cannot undo a pause.

use anchor_lang::prelude::*;

use crate::errors::GuardrailsError;
use crate::events::AgentPaused;
use crate::state::policy::PermissionPolicy;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct PauseAgent<'info> {
    /// The caller requesting the pause. Must be either the policy owner or
    /// one of the policy's authorized_monitors. Validated in handler body
    /// (not via has_one, because monitors are a Vec, not a single field).
    pub caller: Signer<'info>,

    /// The PermissionPolicy PDA to pause. Mutable because is_active,
    /// paused_by, and paused_reason fields are modified.
    #[account(
        mut,
        seeds = [b"policy", policy.owner.as_ref(), policy.agent.as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, PermissionPolicy>,
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

/// Arguments for pausing an agent.
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PauseAgentArgs {
    /// Human-readable reason for the pause, up to 64 bytes.
    /// Truncated if longer, zero-padded if shorter.
    pub reason: Vec<u8>,
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// Pauses an agent by disabling the policy kill switch.
///
/// Flow:
///   1. Verify caller is owner or authorized monitor
///   2. Set is_active = false, paused_by = caller, copy reason bytes
///   3. Emit AgentPaused event
pub fn handler(ctx: Context<PauseAgent>, args: PauseAgentArgs) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let caller_key = ctx.accounts.caller.key();

    // --- Authorization: owner OR authorized monitor ---
    let is_owner = caller_key == policy.owner;
    let is_monitor = policy.authorized_monitors.contains(&caller_key);

    require!(is_owner || is_monitor, GuardrailsError::UnauthorizedPauser);

    // --- Apply pause state ---
    policy.is_active = false;
    policy.paused_by = Some(caller_key);

    // Copy reason bytes into the fixed-size field, zero-padding if shorter
    let mut reason_bytes = [0u8; 64];
    let copy_len = args.reason.len().min(64);
    reason_bytes[..copy_len].copy_from_slice(&args.reason[..copy_len]);
    policy.paused_reason = reason_bytes;

    // --- Emit event ---
    let clock = Clock::get()?;
    emit!(AgentPaused {
        policy: policy.key(),
        paused_by: caller_key,
        reason: policy.paused_reason,
        timestamp: clock.unix_timestamp,
    });

    msg!("Agent paused by {}", caller_key);

    Ok(())
}
