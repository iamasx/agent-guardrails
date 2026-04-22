/**
 * Mock incidents — mirrors `incidents` table (server/prisma/schema.prisma)
 *
 * Two incidents:
 * 1. Alpha Scanner paused by AI judge after draining sequence (full Opus report)
 * 2. An older resolved incident (manually paused by owner, resolved next day)
 *
 * Covers: null triggeringTxnSig, null judgeVerdictId, null fullReport,
 * resolved incident with resolution text.
 */

export interface Incident {
  id: string;
  policyPubkey: string;
  pausedAt: string;
  pausedBy: string;
  reason: string;
  triggeringTxnSig: string | null;
  judgeVerdictId: string | null;
  fullReport: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
}

export const INCIDENTS: Incident[] = [
  {
    id: "e5f6a7b8-0001-4000-8000-000000000001",
    policyPubkey: "CsZ5LZkDS7h9TDKjt4zMJSiP8bZzYLkWsa4bGMQKDqeE",
    pausedAt: "2026-04-21T15:00:06Z",
    pausedBy: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // monitor
    reason: "Draining sequence detected by Claude judge",
    triggeringTxnSig: "2KlM3nP4qR5sT6uV7wX8yZ9aB1cD2eF3gH4jK5lM6nP7qR8sT9uV1wX2yZ3aB4cD5eF6gH7jK8lM9nP",
    judgeVerdictId: "d4e5f6a7-0003-4000-8000-000000000006",
    fullReport: `# Incident Report — Alpha Scanner (CsZ5...QAA)

## Summary
Agent "Alpha Scanner" was automatically paused at 2026-04-21T15:00:06Z after the monitoring system detected a high-confidence draining sequence. The agent executed 3 transactions in 5 seconds to an unwhitelisted program (DezX...B263) with escalating amounts approaching the per-transaction cap.

## Timeline
| Time | Event | Detail |
|---|---|---|
| 09:10:00 | Normal txn | Jupiter swap, 0.5 SOL — prefilter allowed |
| 12:00:00 | Normal txn | Jupiter swap, 0.8 SOL — prefilter allowed |
| 14:55:00 | Normal txn | System transfer, 0.4 SOL — prefilter allowed |
| 15:00:00 | ⚠️ Suspicious | Unknown program DezX...B263, 1.8 SOL (90% of cap) — FLAG, confidence 72% |
| 15:00:02 | ⚠️ Suspicious | Same program, 1.9 SOL (95% of cap) — FLAG, confidence 65% |
| 15:00:05 | 🛑 Draining | Same program, 1.95 SOL (97.5% of cap) — PAUSE, confidence 94% |
| 15:00:06 | Agent paused | Monitor 9WzD...WWM executed pause_agent on-chain |

## Anomaly Signals
- **New program:** DezX...B263 never seen in this agent's history
- **Burst activity:** 3 transactions in 5 seconds (normal baseline: ~1 txn per 2 hours)
- **Escalating amounts:** 1.8 → 1.9 → 1.95 SOL, approaching the 2 SOL cap
- **Session proximity:** Session expires in 58 minutes — common attack window
- **Cumulative spend:** 42% of daily budget consumed in the burst alone

## Judge Reasoning Chain
1. **Txn at 15:00:00 (FLAG):** "New program not seen before + amount at 90% of cap. Monitoring."
2. **Txn at 15:00:02 (FLAG):** "Burst: 2 txns in 2s to unknown program, amount at 95% of cap. Elevated risk."
3. **Txn at 15:00:05 (PAUSE):** "Draining sequence confirmed: 3 txns in 5s to unwhitelisted program, escalating amounts, session expiring in 58 mins."

## Root Cause Assessment
The agent session key appears to have been compromised or the agent's decision-making was manipulated. The behavioral shift from routine Jupiter swaps to rapid-fire transactions to an unknown program is inconsistent with the agent's 11-day history.

## Recommended Policy Changes
1. **Remove or rotate the agent session key** — the current key should be considered compromised
2. **Reduce per-transaction cap** from 2 SOL to 1 SOL — limits blast radius
3. **Add rate limiting** — flag if >2 txns in 30 seconds (current threshold was 5 in 60s)
4. **Review the target program** DezX...B263 — determine if it should be explicitly blacklisted

## Model Information
- Detection model: claude-haiku-4-5-20251001
- Report model: claude-opus-4-7
- Total judge latency: 4,050ms across 3 evaluations
- Total tokens: 1,642 input, 255 output`,
    resolvedAt: null,
    resolution: null,
    createdAt: "2026-04-21T15:00:07Z",
  },
  // Older resolved incident — manually paused by owner, no judge involved
  {
    id: "e5f6a7b8-0002-4000-8000-000000000001",
    policyPubkey: "8dHEsGNtQ2obTBbh8mxmXJ3A6stUdmKz1KfLFbm2WDNG",
    pausedAt: "2026-04-18T11:30:00Z",
    pausedBy: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", // owner (Alice)
    reason: "Manual pause for policy review — adjusting daily limits",
    triggeringTxnSig: null,           // no specific txn triggered this
    judgeVerdictId: null,             // no judge involved — manual pause
    fullReport: null,                 // no Opus report for manual pauses
    resolvedAt: "2026-04-19T09:00:00Z",
    resolution: "Policy updated: daily budget increased from 50 SOL to 100 SOL. Agent resumed after review.",
    createdAt: "2026-04-18T11:30:01Z",
  },
];
