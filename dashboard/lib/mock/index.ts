/**
 * Mock data barrel export.
 *
 * All data matches the Prisma schema in server/prisma/schema.prisma.
 * Use this for building the dashboard UI without real backend.
 * Swap for real server API calls when ready.
 *
 * BigInt fields (lamports, slot) are serialized as strings — matches
 * what the server API returns via JSON.
 *
 * Narrative:
 * - Yield Bot (trader): 8 normal Jupiter swaps, all healthy
 * - Staking Agent (staker): 4 normal Marinade operations, all healthy
 * - Alpha Scanner (attacker): 3 normal txns, then 4-txn burst to unknown
 *   program with escalating amounts → FLAG → FLAG → PAUSE
 * - Treasury Manager: 2 large txns (one escalated to Squads multisig)
 * - Test Agent: expired session, no label
 * - 2 incidents: one AI-triggered with Opus report, one manual (resolved)
 */

export { POLICIES, PROGRAM_LABELS, MONITOR } from "./policies";
export type { Policy } from "./policies";

export { TRANSACTIONS } from "./transactions";
export type { GuardedTxn } from "./transactions";

export { VERDICTS } from "./verdicts";
export type { AnomalyVerdict } from "./verdicts";

export { INCIDENTS } from "./incidents";
export type { Incident } from "./incidents";
