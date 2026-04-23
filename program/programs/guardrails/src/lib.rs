//! Agent Guardrails Protocol — on-chain policy enforcement for Solana AI agents.
//!
//! This program enforces allow-lists, spending budgets, session expiry, and
//! kill switches on AI agent transactions via PDA-guarded CPIs.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// Re-export instruction types at crate root. The #[program] macro generates code
// that looks for __client_accounts_* modules at crate::*, so glob re-exports are
// needed for each implemented instruction module.
#[allow(ambiguous_glob_reexports)]
pub use instructions::escalate_to_squads::*;
pub use instructions::guarded_execute::*;
pub use instructions::initialize_policy::*;
pub use instructions::pause_agent::*;
pub use instructions::resume_agent::*;
pub use instructions::rotate_agent_key::*;
pub use instructions::update_policy::*;

declare_id!("ENzC6oJhL2bVELvRCZqN4JizFNPTCTfMR5Gz1YJb4u76");

#[program]
pub mod guardrails {
    use super::*;

    /// Creates a PermissionPolicy PDA and its companion SpendTracker PDA.
    /// Called once per (owner, agent) pair. Owner signs and pays rent.
    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        args: InitializePolicyArgs,
    ) -> Result<()> {
        instructions::initialize_policy::handler(ctx, args)
    }

    /// Updates configurable fields on an existing PermissionPolicy.
    /// Only the stored owner can call this. Fields wrapped in None are unchanged.
    pub fn update_policy(ctx: Context<UpdatePolicy>, args: UpdatePolicyArgs) -> Result<()> {
        instructions::update_policy::handler(ctx, args)
    }

    /// Core CPI execution instruction. Validates agent permissions against the
    /// policy, verifies spending amounts, and executes the target program
    /// instruction via PDA-signed CPI. See IMPLEMENTATION.md §3 for the
    /// full 12-step flow.
    pub fn guarded_execute(ctx: Context<GuardedExecute>, args: GuardedExecuteArgs) -> Result<()> {
        instructions::guarded_execute::handler(ctx, args)
    }

    /// Pauses an agent. Callable by the policy owner or any authorized monitor.
    /// Sets is_active = false, preventing all guarded_execute calls.
    pub fn pause_agent(ctx: Context<PauseAgent>, args: PauseAgentArgs) -> Result<()> {
        instructions::pause_agent::handler(ctx, args)
    }

    /// Resumes a paused agent. Only the policy owner can call this — monitors
    /// are excluded to ensure human review before resumption.
    pub fn resume_agent(ctx: Context<ResumeAgent>) -> Result<()> {
        instructions::resume_agent::handler(ctx)
    }

    /// Rotates the agent session key. STUB — not yet implemented for MVP.
    /// Returns NotYetImplemented error.
    pub fn rotate_agent_key(ctx: Context<RotateAgentKey>) -> Result<()> {
        instructions::rotate_agent_key::handler(ctx)
    }

    /// Standalone Squads escalation. STUB — escalation is handled inside
    /// guarded_execute step 8 for MVP. This is a no-op.
    pub fn escalate_to_squads(ctx: Context<EscalateToSquads>) -> Result<()> {
        instructions::escalate_to_squads::handler(ctx)
    }
}
