//! On-chain account definitions for the Guardrails program.
//!
//! Re-exports the two PDA account types and their associated constants
//! so that instruction handlers can import them via `crate::state::*`.

pub mod policy;
pub mod spend_tracker;

pub use policy::*;
pub use spend_tracker::*;
