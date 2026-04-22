/**
 * Mock anomaly_verdicts — mirrors `anomaly_verdicts` table (server/prisma/schema.prisma)
 *
 * Narrative:
 * - Yield Bot + Staking Agent: all prefilter-skipped (routine txns)
 * - Alpha Scanner normal txns: prefilter-skipped
 * - Alpha Scanner burst: FLAG on first suspicious, then PAUSE
 * - Treasury Manager: one normal allow, one prefilter flag (large amount)
 */

export interface AnomalyVerdict {
  id: string;
  txnId: string;
  policyPubkey: string;
  verdict: "allow" | "flag" | "pause";
  confidence: number; // 0–100
  reasoning: string;
  model: string;
  latencyMs: number | null;
  prefilterSkipped: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: string;
}

const YIELD_BOT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const STAKING_AGENT = "8dHEsGNtQ2obTBbh8mxmXJ3A6stUdmKz1KfLFbm2WDNG";
const ALPHA_SCANNER = "CsZ5LZkDS7h9TDKjt4zMJSiP8bZzYLkWsa4bGMQKDqeE";
const TREASURY = "F7nQ8rT5sU6vW7xY8zA9bC1dE2fG3hJ4kL5mN6pQ7rS";

export const VERDICTS: AnomalyVerdict[] = [
  // === Yield Bot — prefilter-skipped (routine) ===
  {
    id: "d4e5f6a7-0001-4000-8000-000000000001",
    txnId: "a1b2c3d4-0001-4000-8000-000000000001",
    policyPubkey: YIELD_BOT,
    verdict: "allow",
    confidence: 95,
    reasoning: "Routine Jupiter swap within normal parameters",
    model: "prefilter",
    latencyMs: null,
    prefilterSkipped: true,
    promptTokens: null,
    completionTokens: null,
    createdAt: "2026-04-21T09:00:13Z",
  },
  // Yield Bot — one Claude-evaluated (amount > 50% of cap)
  {
    id: "d4e5f6a7-0001-4000-8000-000000000002",
    txnId: "a1b2c3d4-0001-4000-8000-000000000004",
    policyPubkey: YIELD_BOT,
    verdict: "allow",
    confidence: 90,
    reasoning: "Jupiter swap at 62% of cap, within historical range",
    model: "claude-haiku-4-5-20251001",
    latencyMs: 1240,
    prefilterSkipped: false,
    promptTokens: 487,
    completionTokens: 62,
    createdAt: "2026-04-21T11:45:02Z",
  },

  // === Staking Agent — prefilter-skipped ===
  {
    id: "d4e5f6a7-0002-4000-8000-000000000001",
    txnId: "b2c3d4e5-0001-4000-8000-000000000001",
    policyPubkey: STAKING_AGENT,
    verdict: "allow",
    confidence: 97,
    reasoning: "Routine Marinade stake within normal parameters",
    model: "prefilter",
    latencyMs: null,
    prefilterSkipped: true,
    promptTokens: null,
    completionTokens: null,
    createdAt: "2026-04-21T09:05:01Z",
  },
  {
    id: "d4e5f6a7-0002-4000-8000-000000000002",
    txnId: "b2c3d4e5-0001-4000-8000-000000000002",
    policyPubkey: STAKING_AGENT,
    verdict: "allow",
    confidence: 88,
    reasoning: "Marinade stake at 80% of cap, elevated but within historical range for this agent",
    model: "claude-haiku-4-5-20251001",
    latencyMs: 1420,
    prefilterSkipped: false,
    promptTokens: 502,
    completionTokens: 71,
    createdAt: "2026-04-21T10:45:02Z",
  },

  // === Alpha Scanner — normal, then FLAG, then PAUSE ===
  {
    id: "d4e5f6a7-0003-4000-8000-000000000001",
    txnId: "c3d4e5f6-0001-4000-8000-000000000001",
    policyPubkey: ALPHA_SCANNER,
    verdict: "allow",
    confidence: 92,
    reasoning: "Normal Jupiter swap, amount below 50% of cap",
    model: "prefilter",
    latencyMs: null,
    prefilterSkipped: true,
    promptTokens: null,
    completionTokens: null,
    createdAt: "2026-04-21T09:10:01Z",
  },
  // First suspicious txn — new program + high amount → FLAG
  {
    id: "d4e5f6a7-0003-4000-8000-000000000004",
    txnId: "c3d4e5f6-0001-4000-8000-000000000004",
    policyPubkey: ALPHA_SCANNER,
    verdict: "flag",
    confidence: 72,
    reasoning: "New program not seen before + amount at 90% of cap. Monitoring.",
    model: "claude-haiku-4-5-20251001",
    latencyMs: 1580,
    prefilterSkipped: false,
    promptTokens: 523,
    completionTokens: 78,
    createdAt: "2026-04-21T15:00:02Z",
  },
  // Second suspicious — burst detected + escalating amounts → FLAG
  {
    id: "d4e5f6a7-0003-4000-8000-000000000005",
    txnId: "c3d4e5f6-0001-4000-8000-000000000005",
    policyPubkey: ALPHA_SCANNER,
    verdict: "flag",
    confidence: 65,
    reasoning: "Burst: 2 txns in 2s to unknown program, amount at 95% of cap. Elevated risk.",
    model: "claude-haiku-4-5-20251001",
    latencyMs: 1320,
    prefilterSkipped: false,
    promptTokens: 548,
    completionTokens: 85,
    createdAt: "2026-04-21T15:00:04Z",
  },
  // Third — clear draining pattern → PAUSE
  {
    id: "d4e5f6a7-0003-4000-8000-000000000006",
    txnId: "c3d4e5f6-0001-4000-8000-000000000006",
    policyPubkey: ALPHA_SCANNER,
    verdict: "pause",
    confidence: 94,
    reasoning: "Draining sequence confirmed: 3 txns in 5s to unwhitelisted program, escalating amounts, session expiring in 58 mins.",
    model: "claude-haiku-4-5-20251001",
    latencyMs: 1150,
    prefilterSkipped: false,
    promptTokens: 571,
    completionTokens: 92,
    createdAt: "2026-04-21T15:00:06Z",
  },

  // === Treasury Manager — normal + large amount flag ===
  {
    id: "d4e5f6a7-0004-4000-8000-000000000001",
    txnId: "d4e5f6a7-1001-4000-8000-000000000001",
    policyPubkey: TREASURY,
    verdict: "allow",
    confidence: 85,
    reasoning: "Jupiter swap at 30% of cap, consistent with treasury operations",
    model: "claude-haiku-4-5-20251001",
    latencyMs: 1380,
    prefilterSkipped: false,
    promptTokens: 510,
    completionTokens: 68,
    createdAt: "2026-04-21T12:30:02Z",
  },
];
