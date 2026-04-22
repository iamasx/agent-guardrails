//! PermissionPolicy account definition.
//!
//! The PermissionPolicy PDA is the central on-chain record governing what an
//! AI agent is allowed to do. It stores the allow-list of target programs,
//! per-transaction and daily spending limits, session expiry, kill-switch
//! state, and optional Squads multisig escalation configuration.
//!
//! PDA seeds: `["policy", owner_pubkey, agent_pubkey]`

use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Maximum number of programs in the allow-list.
/// Kept small for MVP to bound account size and CPI iteration cost.
pub const MAX_ALLOWED_PROGRAMS: usize = 10;

/// Maximum number of off-chain monitors authorized to call `pause_agent`.
pub const MAX_AUTHORIZED_MONITORS: usize = 3;

/// Seconds in one day (24 hours). Used for rolling budget window resets.
pub const SECONDS_PER_DAY: i64 = 86_400;

/// Total account size in bytes INCLUDING the 8-byte Anchor discriminator.
///
/// Breakdown:
/// ```text
///   8   discriminator
///  32   owner
///  32   agent
/// 324   allowed_programs     (4 + 32 * 10)
///   8   max_tx_lamports
///   8   max_tx_token_units
///   8   daily_budget_lamports
///   8   daily_spent_lamports
///   8   last_reset_ts
///   8   session_expiry
///   1   is_active
///  33   paused_by            (1 + 32)
///  64   paused_reason
///  33   squads_multisig      (1 + 32)
///   8   escalation_threshold
/// 100   authorized_monitors  (4 + 32 * 3)
///   1   anomaly_score
///   1   bump
/// ───
/// 685
/// ```
pub const PERMISSION_POLICY_SIZE: usize = 685;

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

#[account]
pub struct PermissionPolicy {
    /// The human wallet that created and controls this policy.
    /// Only the owner can update limits, resume a paused agent, or rotate keys.
    pub owner: Pubkey,

    /// The agent session pubkey. This key signs `guarded_execute` transactions
    /// but holds no funds — the policy PDA is the actual authority over funds.
    pub agent: Pubkey,

    /// Program IDs the agent is allowed to CPI into via `guarded_execute`.
    /// Capped at MAX_ALLOWED_PROGRAMS (10) entries for MVP.
    pub allowed_programs: Vec<Pubkey>,

    /// Maximum lamports the agent can spend in a single transaction.
    pub max_tx_lamports: u64,

    /// Maximum SPL token units (raw, not decimal-adjusted) per transaction.
    pub max_tx_token_units: u64,

    /// Maximum lamports the agent can spend in a rolling 24-hour window.
    pub daily_budget_lamports: u64,

    /// Lamports spent so far in the current 24-hour window.
    /// Reset to 0 when the window rolls over (see `is_budget_window_expired`).
    pub daily_spent_lamports: u64,

    /// Unix timestamp marking the start of the current budget window.
    /// When `now > last_reset_ts + SECONDS_PER_DAY`, the window resets.
    pub last_reset_ts: i64,

    /// Unix timestamp after which the agent session key is no longer valid.
    /// Any `guarded_execute` call after this time is rejected with SessionExpired.
    pub session_expiry: i64,

    /// Kill switch. When false, all `guarded_execute` calls are rejected
    /// immediately. Set to false by `pause_agent`, restored by `resume_agent`.
    pub is_active: bool,

    /// The pubkey of whoever paused this policy (owner, monitor, or multisig).
    /// None when the policy is active.
    pub paused_by: Option<Pubkey>,

    /// Short human-readable reason for the pause, stored as fixed-size bytes.
    /// Padded with trailing zeros if the reason is shorter than 64 bytes.
    /// Not a String — account structs must use fixed-size types.
    pub paused_reason: [u8; 64],

    /// Optional Squads v4 multisig address. When set, transactions exceeding
    /// `escalation_threshold` are routed to Squads for multi-sig approval
    /// instead of being executed directly.
    pub squads_multisig: Option<Pubkey>,

    /// Lamport threshold above which a transaction requires Squads approval.
    /// Only meaningful when `squads_multisig` is Some.
    pub escalation_threshold: u64,

    /// Off-chain monitor pubkeys authorized to call `pause_agent`.
    /// Capped at MAX_AUTHORIZED_MONITORS (3). The owner can always pause
    /// without being in this list.
    pub authorized_monitors: Vec<Pubkey>,

    /// Most recent anomaly score assigned by the Claude judge (0–100).
    /// Written by the server via `update_policy` after anomaly detection.
    /// 0 = clean, 100 = maximum anomaly.
    pub anomaly_score: u8,

    /// PDA bump seed, stored to avoid recomputing on every constraint check.
    pub bump: u8,
}

impl PermissionPolicy {
    /// Returns true if the rolling 24-hour budget window has expired,
    /// meaning `daily_spent_lamports` should be reset before checking
    /// the budget. The actual reset (zeroing counters, updating timestamps)
    /// is performed by the `guarded_execute` instruction handler.
    pub fn is_budget_window_expired(&self, current_timestamp: i64) -> bool {
        self.last_reset_ts
            .checked_add(SECONDS_PER_DAY)
            .map(|expiry| current_timestamp > expiry)
            .unwrap_or(true)
    }
}
