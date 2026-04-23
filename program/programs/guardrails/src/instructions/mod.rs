//! Instruction handlers for the Guardrails program.
//!
//! Each instruction lives in its own module file. Implemented modules
//! re-export their Accounts context and Args structs so `lib.rs` can
//! import them via `use crate::instructions::*`.

pub mod escalate_to_squads;
pub mod guarded_execute;
pub mod initialize_policy;
pub mod pause_agent;
pub mod resume_agent;
pub mod rotate_agent_key;
pub mod update_policy;

// Note: lib.rs uses `pub use instructions::initialize_policy::*` etc. to
// re-export types at crate root (required by the #[program] macro).
