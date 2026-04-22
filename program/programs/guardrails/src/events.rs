//! Anchor events emitted by the Guardrails program.
//!
//! These events are serialized into Solana transaction logs via `emit!()` and
//! consumed by Helius webhooks, which forward them to the server worker
//! pipeline for anomaly detection, incident creation, and dashboard updates.
//!
//! Events are NOT stored in account data, so `String` is acceptable here
//! (unlike account structs which must use fixed-size types).

use anchor_lang::prelude::*;

/// Emitted after a successful `guarded_execute` CPI.
/// The server ingests this to record the transaction and feed it to the
/// Claude judge for anomaly scoring.
#[event]
pub struct GuardedTxnExecuted {
    /// The PermissionPolicy PDA that governed this transaction.
    pub policy: Pubkey,
    /// The agent session key that initiated the transaction.
    pub agent: Pubkey,
    /// The program that was invoked via CPI.
    pub target_program: Pubkey,
    /// Lamports transferred — the verified amount parsed from instruction data,
    /// not the agent-supplied `amount_hint`.
    pub amount: u64,
    /// Unix timestamp from the Solana clock at execution time.
    pub timestamp: i64,
    /// Base58-encoded transaction signature. String is fine in events since
    /// they are log data, not account data.
    pub txn_sig: String,
}

/// Emitted when `guarded_execute` rejects a transaction — either during
/// pre-CPI validation (policy paused, session expired, program not
/// whitelisted, spending limit exceeded) or when the downstream CPI itself
/// fails.
///
/// On Solana, program logs (`emit!()`) persist in the transaction metadata
/// even when the transaction ultimately fails, so this event is emitted
/// immediately before the instruction returns an error and will be visible
/// to Helius webhooks monitoring failed transactions.
#[event]
pub struct GuardedTxnRejected {
    /// The PermissionPolicy PDA for this transaction.
    pub policy: Pubkey,
    /// The agent session key that attempted the transaction.
    pub agent: Pubkey,
    /// Rejection reason as a numeric code:
    ///   0 = PolicyPaused
    ///   1 = SessionExpired
    ///   2 = ProgramNotWhitelisted
    ///   3 = AmountExceedsLimit
    ///   4 = DailyBudgetExceeded
    ///   5 = CpiFailure
    pub reason: u8,
    /// Unix timestamp from the Solana clock.
    pub timestamp: i64,
}

/// Emitted when `pause_agent` is called by the owner or an authorized monitor.
/// The server uses this to create an incident and notify the dashboard via SSE.
#[event]
pub struct AgentPaused {
    /// The PermissionPolicy PDA that was paused.
    pub policy: Pubkey,
    /// The pubkey of whoever triggered the pause (owner or monitor).
    pub paused_by: Pubkey,
    /// The pause reason, copied from the instruction input.
    /// Fixed 64-byte array, padded with trailing zeros.
    pub reason: [u8; 64],
    /// Unix timestamp from the Solana clock.
    pub timestamp: i64,
}

/// Emitted when a transaction is escalated to Squads multisig for approval
/// instead of being executed directly.
///
/// In MVP, the on-chain program returns `EscalatedToMultisig` error and the
/// server handles proposal creation off-chain. This event is defined for IDL
/// completeness and future on-chain Squads CPI support.
#[event]
pub struct EscalatedToSquads {
    /// The PermissionPolicy PDA that triggered the escalation.
    pub policy: Pubkey,
    /// The Squads proposal address. In MVP this is Pubkey::default() because
    /// the proposal is created off-chain by the server after catching the error.
    pub squads_proposal: Pubkey,
    /// The transaction amount that exceeded `escalation_threshold`.
    pub amount: u64,
}
