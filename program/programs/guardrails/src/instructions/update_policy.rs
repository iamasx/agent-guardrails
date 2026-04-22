//! update_policy instruction handler.
//!
//! Allows the policy owner to modify configurable fields on an existing
//! PermissionPolicy. Uses `Option<T>` for each field so the caller only
//! sends the fields they want to change — unchanged fields are left as-is.
//!
//! Non-updatable fields (managed by other instructions or PDA derivation):
//!   owner, agent, bump, daily_spent_lamports, last_reset_ts,
//!   is_active, paused_by, paused_reason

use anchor_lang::prelude::*;

use crate::errors::GuardrailsError;
use crate::state::policy::{PermissionPolicy, MAX_ALLOWED_PROGRAMS, MAX_AUTHORIZED_MONITORS};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    /// The policy owner. Must sign. The `has_one` constraint on `policy`
    /// verifies that this signer matches the stored `policy.owner`.
    pub owner: Signer<'info>,

    /// The PermissionPolicy PDA to update. Only the stored owner can modify it.
    /// The `has_one = owner` constraint enforces ownership — Anchor checks
    /// `policy.owner == owner.key()` and returns ConstraintHasOne on mismatch.
    #[account(
        mut,
        seeds = [b"policy", policy.owner.as_ref(), policy.agent.as_ref()],
        bump = policy.bump,
        has_one = owner,
    )]
    pub policy: Account<'info, PermissionPolicy>,
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

/// Arguments for updating a PermissionPolicy. Every field is wrapped in
/// `Option<T>` — only `Some` values are applied, `None` means "leave unchanged."
///
/// To clear `squads_multisig` back to None, pass `Some(Pubkey::default())`
/// (all-zero pubkey is interpreted as "remove multisig").
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdatePolicyArgs {
    /// Replace the entire allow-list. None = leave unchanged.
    pub allowed_programs: Option<Vec<Pubkey>>,
    /// New per-transaction lamport cap. None = leave unchanged.
    pub max_tx_lamports: Option<u64>,
    /// New per-transaction SPL token unit cap. None = leave unchanged.
    pub max_tx_token_units: Option<u64>,
    /// New rolling 24h lamport budget. None = leave unchanged.
    pub daily_budget_lamports: Option<u64>,
    /// New session expiry timestamp. None = leave unchanged.
    pub session_expiry: Option<i64>,
    /// New Squads multisig address. None = leave unchanged.
    /// Pass Some(Pubkey::default()) to clear the multisig.
    pub squads_multisig: Option<Pubkey>,
    /// New escalation threshold in lamports. None = leave unchanged.
    pub escalation_threshold: Option<u64>,
    /// Replace the entire monitor list. None = leave unchanged.
    pub authorized_monitors: Option<Vec<Pubkey>>,
    /// New anomaly score (set by server after Claude judge run). None = leave unchanged.
    pub anomaly_score: Option<u8>,
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// Updates configurable fields on an existing PermissionPolicy.
///
/// Flow:
///   1. Apply each `Some` field, validating constraints as we go
///   2. Run a post-update coherence check (max_tx <= daily_budget)
pub fn handler(ctx: Context<UpdatePolicy>, args: UpdatePolicyArgs) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    // --- Apply optional field updates, validating as we go ---

    if let Some(programs) = args.allowed_programs {
        require!(
            programs.len() <= MAX_ALLOWED_PROGRAMS,
            GuardrailsError::TooManyAllowedPrograms
        );
        policy.allowed_programs = programs;
    }

    if let Some(max_tx) = args.max_tx_lamports {
        policy.max_tx_lamports = max_tx;
    }

    if let Some(max_token) = args.max_tx_token_units {
        policy.max_tx_token_units = max_token;
    }

    if let Some(budget) = args.daily_budget_lamports {
        policy.daily_budget_lamports = budget;
    }

    if let Some(expiry) = args.session_expiry {
        // Only validate expiry when it's being updated — don't block updates
        // to unrelated fields when the existing expiry has already passed
        let clock = Clock::get()?;
        require!(
            expiry > clock.unix_timestamp,
            GuardrailsError::SessionExpiryInPast
        );
        policy.session_expiry = expiry;
    }

    if let Some(multisig) = args.squads_multisig {
        // All-zero pubkey is the "clear" sentinel — removes the multisig
        if multisig == Pubkey::default() {
            policy.squads_multisig = None;
        } else {
            policy.squads_multisig = Some(multisig);
        }
    }

    if let Some(threshold) = args.escalation_threshold {
        policy.escalation_threshold = threshold;
    }

    if let Some(monitors) = args.authorized_monitors {
        require!(
            monitors.len() <= MAX_AUTHORIZED_MONITORS,
            GuardrailsError::TooManyMonitors
        );
        policy.authorized_monitors = monitors;
    }

    if let Some(score) = args.anomaly_score {
        policy.anomaly_score = score;
    }

    // --- Post-update coherence check ---
    // Even if only one of these was updated, the final state must be coherent:
    // a single transaction cap should never exceed the daily budget.
    require!(
        policy.max_tx_lamports <= policy.daily_budget_lamports,
        GuardrailsError::TxLimitExceedsDailyBudget
    );

    msg!("Policy updated for agent {}", policy.agent);

    Ok(())
}
