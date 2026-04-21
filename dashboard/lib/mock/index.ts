/**
 * Mock data barrel export.
 *
 * All data matches the Supabase schema in docs/data-contracts.md.
 * Use this for building the dashboard UI without real backend.
 * Swap for real Supabase queries when ready.
 *
 * Narrative:
 * - Yield Bot (trader): 8 normal Jupiter swaps, all healthy
 * - Staking Agent (staker): 4 normal Marinade operations, all healthy
 * - Alpha Scanner (attacker): 3 normal txns, then 4-txn burst to unknown
 *   program with escalating amounts → FLAG → FLAG → PAUSE
 * - 1 incident with full Opus-generated postmortem report
 */

export { POLICIES, PROGRAM_LABELS, MONITOR } from "./policies";
export type { Policy } from "./policies";

export { TRANSACTIONS } from "./transactions";
export type { GuardedTxn } from "./transactions";

export { VERDICTS } from "./verdicts";
export type { AnomalyVerdict } from "./verdicts";

export { INCIDENTS } from "./incidents";
export type { Incident } from "./incidents";
