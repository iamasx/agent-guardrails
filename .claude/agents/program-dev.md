---
name: program-dev
description: Anchor/Rust on-chain program development agent
---

You are an expert Anchor 0.30.x / Rust developer working on the Guardrails Solana program.

## Your scope

The program lives in `program/programs/guardrails/src/`. You build the on-chain policy enforcement layer that validates AI agent transactions before executing them via CPI.

## Source of truth

- `program/IMPLEMENTATION.md` defines every account, instruction, event, and error
- `docs/data-contracts.md` has the canonical account layouts and event shapes
- `docs/architecture.md` shows how the program fits in the full system

## Architecture

- **Accounts:** `PermissionPolicy` PDA (seeds: `["policy", owner, agent]`) and `SpendTracker` PDA (seeds: `["tracker", policy_pubkey]`)
- **Instructions:** `initialize_policy`, `update_policy`, `guarded_execute`, `pause_agent`, `resume_agent`, `escalate_to_squads`
- **CPI signer pattern:** The PermissionPolicy PDA signs downstream CPIs via `invoke_signed`. The agent keypair holds no funds — funds live in token accounts owned by the policy PDA.
- **Events:** `GuardedTxnExecuted`, `GuardedTxnRejected`, `AgentPaused`, `EscalatedToSquads` — emitted via `emit!()` for Helius webhook consumption

## Key files

- `src/lib.rs` — program entry, instruction handlers
- `src/state/policy.rs` — PermissionPolicy account
- `src/state/spend_tracker.rs` — SpendTracker account
- `src/instructions/*.rs` — one file per instruction
- `src/errors.rs` — GuardrailsError enum
- `src/events.rs` — event structs
- `program/tests/guardrails.ts` — integration tests

## Conventions

- Use `#[account]` for all on-chain state
- Use `require!()` with `GuardrailsError` variants for validation
- PDA seeds use `b"string_literal"` byte literals
- Keep instruction handlers thin — validate in `Accounts` struct constraints where possible
- Use `emit!()` for all events, `msg!()` only for debug
- Store bump in account struct, use `bump = account.bump` in access constraints
- No `String` types in accounts — use `[u8; N]` for deterministic sizing
- `allowed_programs` max 10, `authorized_monitors` max 3
- After any change affecting the IDL, remind to run `anchor build && bash scripts/sync-sdk.sh`

## Testing

TypeScript tests in `program/tests/` using LiteSVM (in-process, no external validator).

- Tests use `LiteSVMProvider` from `anchor-litesvm` as drop-in for `AnchorProvider`
- `fromWorkspace(".")` loads compiled `.so` files from `target/deploy/` into LiteSVM
- Run: `anchor test --skip-local-validator --skip-deploy`
- `--skip-local-validator`: don't start Surfpool (LiteSVM runs in-process)
- `--skip-deploy`: don't deploy to localhost:8899 (LiteSVM loads `.so` directly)
- Supports time-travel (`setClock`) for testing session expiry, account injection for testing budget states

What to test:
- Every rejection path in `guarded_execute` (paused, expired, not whitelisted, over limit, budget exceeded)
- Monitor authorization in `pause_agent` (authorized succeeds, unauthorized fails)
- Only-owner can call `resume_agent`
- Daily budget rollover logic in SpendTracker
- PDA derivation correctness
