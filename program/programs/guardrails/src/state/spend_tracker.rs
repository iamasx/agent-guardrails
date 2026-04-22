//! SpendTracker account definition.
//!
//! A separate PDA that tracks rolling spend metrics for a policy. Stored in
//! its own account (rather than inlined into PermissionPolicy) so that the
//! frequent counter updates from `guarded_execute` do not trigger realloc
//! on the larger policy account.
//!
//! PDA seeds: `["tracker", policy_pubkey]`

use anchor_lang::prelude::*;

/// Total account size in bytes INCLUDING the 8-byte Anchor discriminator.
///
/// Breakdown:
/// ```text
///   8   discriminator
///  32   policy
///   8   window_start
///   4   txn_count_24h
///   8   lamports_spent_24h
///   8   last_txn_ts
///  32   last_txn_program
///   1   bump
/// ───
/// 101
/// ```
pub const SPEND_TRACKER_SIZE: usize = 101;

#[account]
pub struct SpendTracker {
    /// The PermissionPolicy PDA this tracker belongs to.
    /// Links back to the parent policy for validation in constraints.
    pub policy: Pubkey,

    /// Unix timestamp marking the start of the current 24-hour tracking window.
    /// When the window expires, `txn_count_24h` and `lamports_spent_24h` reset.
    pub window_start: i64,

    /// Number of successful guarded transactions in the current window.
    /// Incremented by 1 on each successful `guarded_execute` CPI.
    pub txn_count_24h: u32,

    /// Total lamports spent through `guarded_execute` in the current window.
    /// Uses the verified amount parsed from instruction data, not `amount_hint`.
    pub lamports_spent_24h: u64,

    /// Unix timestamp of the most recent successful transaction.
    pub last_txn_ts: i64,

    /// Program ID invoked in the most recent successful transaction.
    /// Useful for server-side anomaly detection (detects sudden program switches).
    /// Initialized to Pubkey::default() (all zeros) until the first transaction.
    pub last_txn_program: Pubkey,

    /// PDA bump seed, stored to avoid recomputing on every constraint check.
    pub bump: u8,
}
