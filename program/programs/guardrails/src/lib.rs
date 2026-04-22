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
pub use instructions::initialize_policy::*;
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

    pub fn guarded_execute(_ctx: Context<GuardedExecute>) -> Result<()> {
        Ok(())
    }

    pub fn pause_agent(_ctx: Context<PauseAgent>) -> Result<()> {
        Ok(())
    }

    pub fn resume_agent(_ctx: Context<ResumeAgent>) -> Result<()> {
        Ok(())
    }

    pub fn rotate_agent_key(_ctx: Context<RotateAgentKey>) -> Result<()> {
        Ok(())
    }

    pub fn escalate_to_squads(_ctx: Context<EscalateToSquads>) -> Result<()> {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Placeholder context structs for unimplemented instructions.
// These will be moved to their respective instruction modules in later phases.
// DO NOT delete — they are required for the program to compile.
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct GuardedExecute {}

#[derive(Accounts)]
pub struct PauseAgent {}

#[derive(Accounts)]
pub struct ResumeAgent {}

#[derive(Accounts)]
pub struct RotateAgentKey {}

#[derive(Accounts)]
pub struct EscalateToSquads {}
