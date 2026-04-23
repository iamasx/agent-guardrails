// Opus incident report — system prompt and user message builder.
// Generates a markdown postmortem report for a pause incident.

import type { GuardedTxn, AnomalyVerdict, Incident } from "@prisma/client";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const REPORT_SYSTEM = `You are a security analyst generating incident postmortem reports for Solana AI agent monitoring.

Write a concise markdown report covering:
1. **Summary** — 1-2 sentence overview of what happened
2. **Timeline** — markdown table of events (time, event, detail)
3. **Anomaly Signals** — list of signals that triggered the investigation
4. **Judge Reasoning** — the AI judge's reasoning chain
5. **Root Cause Assessment** — likely cause of the anomalous behavior
6. **Recommended Policy Changes** — actionable suggestions to prevent recurrence

Keep the report under 1500 words. Use precise timestamps and amounts. Do not speculate beyond the evidence provided.`;

// ---------------------------------------------------------------------------
// Types for the report builder
// ---------------------------------------------------------------------------

type TxnWithVerdict = GuardedTxn & { verdict: AnomalyVerdict | null };
type IncidentWithVerdict = Incident & { judgeVerdict: AnomalyVerdict | null };

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

const LAMPORTS_PER_SOL = 1_000_000_000;

function lamportsToSol(lamports: bigint | number | null): string {
  return (Number(lamports ?? 0) / LAMPORTS_PER_SOL).toFixed(6);
}

export function buildReportUserMessage(
  incident: IncidentWithVerdict,
  history: TxnWithVerdict[],
): string {
  const timelineRows = history
    .map((t) => {
      const time = t.blockTime.toISOString().slice(11, 19);
      const verdict = t.verdict?.verdict ?? "—";
      const confidence = t.verdict?.confidence != null ? `${t.verdict.confidence}%` : "—";
      return `| ${time} | ${t.status} | ${t.targetProgram.slice(0, 12)}… | ${lamportsToSol(t.amountLamports)} SOL | ${verdict} (${confidence}) |`;
    })
    .join("\n");

  const judgeReasoning = incident.judgeVerdict
    ? `Verdict: ${incident.judgeVerdict.verdict} (${incident.judgeVerdict.confidence}% confidence)
Reasoning: ${incident.judgeVerdict.reasoning}
Model: ${incident.judgeVerdict.model}
Latency: ${incident.judgeVerdict.latencyMs ?? "n/a"}ms`
    : "No judge verdict available";

  return `INCIDENT DETAILS:
- Incident ID: ${incident.id}
- Policy: ${incident.policyPubkey}
- Paused at: ${incident.pausedAt.toISOString()}
- Paused by: ${incident.pausedBy}
- Reason: ${incident.reason}
- Triggering txn: ${incident.triggeringTxnSig ?? "n/a"}

JUDGE VERDICT:
${judgeReasoning}

TRANSACTION HISTORY (last 24 hours, ${history.length} transactions):
| Time | Status | Program | Amount | Verdict |
|------|--------|---------|--------|---------|
${timelineRows || "| — | — | — | — | — |"}

Total transactions: ${history.length}
Flagged: ${history.filter((t) => t.verdict?.verdict === "flag").length}
Paused: ${history.filter((t) => t.verdict?.verdict === "pause").length}
Prefilter-skipped: ${history.filter((t) => t.verdict?.prefilterSkipped).length}

Generate the incident postmortem report.`;
}
