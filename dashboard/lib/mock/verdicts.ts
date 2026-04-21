/**
 * Mock anomaly_verdicts — mirrors `anomaly_verdicts` table (server/prisma/schema.prisma)
 *
 * Narrative:
 * - Yield Bot + Staking Agent: all prefilter-skipped (routine txns)
 * - Alpha Scanner normal txns: prefilter-skipped
 * - Alpha Scanner burst: FLAG on first suspicious, then PAUSE
 */

export interface AnomalyVerdict {
  id: string;
  txn_id: string;
  policy_pubkey: string;
  verdict: "allow" | "flag" | "pause";
  confidence: number; // 0–100
  reasoning: string;
  model: string;
  latency_ms: number | null;
  prefilter_skipped: boolean;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
}

const ALPHA_SCANNER = "CsZ5LZkDS7h9TDKjt4zMJSiP8bZzYLkWsa4bGMQKDqeE";

export const VERDICTS: AnomalyVerdict[] = [
  // === Yield Bot — all prefilter-skipped (routine) ===
  {
    id: "d4e5f6a7-0001-4000-8000-000000000001",
    txn_id: "a1b2c3d4-0001-4000-8000-000000000001",
    policy_pubkey: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    verdict: "allow",
    confidence: 95,
    reasoning: "Routine Jupiter swap within normal parameters",
    model: "prefilter",
    latency_ms: null,
    prefilter_skipped: true,
    prompt_tokens: null,
    completion_tokens: null,
    created_at: "2026-04-21T09:00:13Z",
  },
  {
    id: "d4e5f6a7-0001-4000-8000-000000000002",
    txn_id: "a1b2c3d4-0001-4000-8000-000000000004",
    policy_pubkey: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    verdict: "allow",
    confidence: 90,
    reasoning: "Jupiter swap at 62% of cap, within historical range",
    model: "claude-haiku-4-5-20251001",
    latency_ms: 1240,
    prefilter_skipped: false,
    prompt_tokens: 487,
    completion_tokens: 62,
    created_at: "2026-04-21T11:45:02Z",
  },

  // === Staking Agent — all prefilter-skipped ===
  {
    id: "d4e5f6a7-0002-4000-8000-000000000001",
    txn_id: "b2c3d4e5-0001-4000-8000-000000000001",
    policy_pubkey: "8dHEsGNtQ2obTBbh8mxmXJ3A6stUdmKz1KfLFbm2WDNG",
    verdict: "allow",
    confidence: 97,
    reasoning: "Routine Marinade stake within normal parameters",
    model: "prefilter",
    latency_ms: null,
    prefilter_skipped: true,
    prompt_tokens: null,
    completion_tokens: null,
    created_at: "2026-04-21T09:05:01Z",
  },

  // === Alpha Scanner — normal, then FLAG, then PAUSE ===
  {
    id: "d4e5f6a7-0003-4000-8000-000000000001",
    txn_id: "c3d4e5f6-0001-4000-8000-000000000001",
    policy_pubkey: ALPHA_SCANNER,
    verdict: "allow",
    confidence: 92,
    reasoning: "Normal Jupiter swap, amount below 50% of cap",
    model: "prefilter",
    latency_ms: null,
    prefilter_skipped: true,
    prompt_tokens: null,
    completion_tokens: null,
    created_at: "2026-04-21T09:10:01Z",
  },
  // First suspicious txn — new program + high amount → FLAG
  {
    id: "d4e5f6a7-0003-4000-8000-000000000004",
    txn_id: "c3d4e5f6-0001-4000-8000-000000000004",
    policy_pubkey: ALPHA_SCANNER,
    verdict: "flag",
    confidence: 72,
    reasoning: "New program not seen before + amount at 90% of cap. Monitoring.",
    model: "claude-haiku-4-5-20251001",
    latency_ms: 1580,
    prefilter_skipped: false,
    prompt_tokens: 523,
    completion_tokens: 78,
    created_at: "2026-04-21T15:00:02Z",
  },
  // Second suspicious — burst detected + escalating amounts → FLAG
  {
    id: "d4e5f6a7-0003-4000-8000-000000000005",
    txn_id: "c3d4e5f6-0001-4000-8000-000000000005",
    policy_pubkey: ALPHA_SCANNER,
    verdict: "flag",
    confidence: 65,
    reasoning: "Burst: 2 txns in 2s to unknown program, amount at 95% of cap. Elevated risk.",
    model: "claude-haiku-4-5-20251001",
    latency_ms: 1320,
    prefilter_skipped: false,
    prompt_tokens: 548,
    completion_tokens: 85,
    created_at: "2026-04-21T15:00:04Z",
  },
  // Third — clear draining pattern → PAUSE
  {
    id: "d4e5f6a7-0003-4000-8000-000000000006",
    txn_id: "c3d4e5f6-0001-4000-8000-000000000006",
    policy_pubkey: ALPHA_SCANNER,
    verdict: "pause",
    confidence: 94,
    reasoning: "Draining sequence confirmed: 3 txns in 5s to unwhitelisted program, escalating amounts, session expiring in 58 mins.",
    model: "claude-haiku-4-5-20251001",
    latency_ms: 1150,
    prefilter_skipped: false,
    prompt_tokens: 571,
    completion_tokens: 92,
    created_at: "2026-04-21T15:00:06Z",
  },
];
