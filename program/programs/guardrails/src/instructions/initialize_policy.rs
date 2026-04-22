//! initialize_policy instruction handler.
//!
//! Creates a PermissionPolicy PDA and its companion SpendTracker PDA. Called
//! once per (owner, agent) pair. The owner signs and pays rent; the agent
//! pubkey is passed as a non-signer account — it will later sign
//! `guarded_execute` transactions.
//!
//! PDA seeds:
//!   - PermissionPolicy: `["policy", owner, agent]`
//!   - SpendTracker:     `["tracker", policy]`

use anchor_lang::prelude::*;

use crate::errors::GuardrailsError;
use crate::state::policy::{
    PermissionPolicy, MAX_ALLOWED_PROGRAMS, MAX_AUTHORIZED_MONITORS, PERMISSION_POLICY_SIZE,
};
use crate::state::spend_tracker::{SpendTracker, SPEND_TRACKER_SIZE};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializePolicy<'info> {
    /// The human owner creating this policy. Signs the transaction and pays
    /// rent for both PDA accounts.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The agent session pubkey used as a PDA seed. Not a signer here — the
    /// agent will sign `guarded_execute` transactions later.
    /// CHECK: Arbitrary pubkey used only for PDA derivation. No data is read.
    pub agent: UncheckedAccount<'info>,

    /// The PermissionPolicy PDA to create.
    /// One policy per unique (owner, agent) pair.
    #[account(
        init,
        payer = owner,
        space = PERMISSION_POLICY_SIZE,
        seeds = [b"policy", owner.key().as_ref(), agent.key().as_ref()],
        bump,
    )]
    pub policy: Account<'info, PermissionPolicy>,

    /// The SpendTracker PDA, created alongside the policy.
    /// Tracks rolling 24h spend metrics in a separate account to avoid
    /// realloc on the larger policy account during frequent updates.
    #[account(
        init,
        payer = owner,
        space = SPEND_TRACKER_SIZE,
        seeds = [b"tracker", policy.key().as_ref()],
        bump,
    )]
    pub spend_tracker: Account<'info, SpendTracker>,

    /// Required by Anchor for PDA account creation (rent payment).
    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

/// Arguments for creating a new PermissionPolicy. All configurable fields
/// are set explicitly — no hidden defaults. Runtime-managed fields (counters,
/// pause state, anomaly score) are initialized to safe defaults by the handler.
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializePolicyArgs {
    /// Program IDs the agent is allowed to CPI into. Max 10.
    pub allowed_programs: Vec<Pubkey>,
    /// Maximum lamports per single transaction.
    pub max_tx_lamports: u64,
    /// Maximum SPL token units (raw, not decimal-adjusted) per transaction.
    pub max_tx_token_units: u64,
    /// Maximum lamports in a rolling 24-hour window.
    pub daily_budget_lamports: u64,
    /// Unix timestamp after which the agent session key expires.
    pub session_expiry: i64,
    /// Optional Squads v4 multisig for high-value escalation. None = disabled.
    pub squads_multisig: Option<Pubkey>,
    /// Lamport threshold above which Squads approval is required.
    /// Only meaningful when `squads_multisig` is Some.
    pub escalation_threshold: u64,
    /// Off-chain monitor pubkeys allowed to call `pause_agent`. Max 3.
    pub authorized_monitors: Vec<Pubkey>,
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// Creates a new PermissionPolicy and its companion SpendTracker.
///
/// Flow:
///   1. Validate input constraints (list sizes, session expiry, budget coherence)
///   2. Populate PermissionPolicy with args + safe defaults
///   3. Initialize SpendTracker with zeroed counters and current timestamp
pub fn handler(ctx: Context<InitializePolicy>, args: InitializePolicyArgs) -> Result<()> {
    // --- Input validation ---

    require!(
        args.allowed_programs.len() <= MAX_ALLOWED_PROGRAMS,
        GuardrailsError::TooManyAllowedPrograms
    );

    require!(
        args.authorized_monitors.len() <= MAX_AUTHORIZED_MONITORS,
        GuardrailsError::TooManyMonitors
    );

    let clock = Clock::get()?;
    require!(
        args.session_expiry > clock.unix_timestamp,
        GuardrailsError::SessionExpiryInPast
    );

    // A single tx cap should never exceed the daily budget — catches config mistakes early
    require!(
        args.max_tx_lamports <= args.daily_budget_lamports,
        GuardrailsError::TxLimitExceedsDailyBudget
    );

    // --- Populate PermissionPolicy ---

    let policy = &mut ctx.accounts.policy;
    policy.owner = ctx.accounts.owner.key();
    policy.agent = ctx.accounts.agent.key();
    policy.allowed_programs = args.allowed_programs;
    policy.max_tx_lamports = args.max_tx_lamports;
    policy.max_tx_token_units = args.max_tx_token_units;
    policy.daily_budget_lamports = args.daily_budget_lamports;
    policy.daily_spent_lamports = 0; // No spend yet
    policy.last_reset_ts = clock.unix_timestamp; // Budget window starts now
    policy.session_expiry = args.session_expiry;
    policy.is_active = true; // Agent can transact immediately
    policy.paused_by = None;
    policy.paused_reason = [0u8; 64]; // No reason — not paused
    policy.squads_multisig = args.squads_multisig;
    policy.escalation_threshold = args.escalation_threshold;
    policy.authorized_monitors = args.authorized_monitors;
    policy.anomaly_score = 0; // Clean slate
    policy.bump = ctx.bumps.policy;

    // --- Initialize SpendTracker ---

    let tracker = &mut ctx.accounts.spend_tracker;
    tracker.policy = policy.key();
    tracker.window_start = clock.unix_timestamp; // Tracking window starts now
    tracker.txn_count_24h = 0;
    tracker.lamports_spent_24h = 0;
    tracker.last_txn_ts = 0; // No transactions yet (epoch = "never")
    tracker.last_txn_program = Pubkey::default(); // All zeros = "no program yet"
    tracker.bump = ctx.bumps.spend_tracker;

    msg!("Policy initialized for agent {}", ctx.accounts.agent.key());

    Ok(())
}
