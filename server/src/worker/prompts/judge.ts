// Claude Haiku judge — system prompt and user message builder.
// Target: <500 input tokens, <200 output tokens, <2s latency.

import { prisma } from "../../db/client.js";
import type { JudgeContext } from "../../types/anomaly.js";
import type { GuardedTxn } from "@prisma/client";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const JUDGE_SYSTEM = `You are an on-chain security judge for Solana AI agents.
You receive a single transaction attempt and must decide: ALLOW, FLAG, or PAUSE.

Respond ONLY with valid JSON matching this schema:
{
  "verdict": "allow" | "flag" | "pause",
  "confidence": 0-100,
  "reasoning": "one sentence, <200 chars",
  "signals": ["short signal strings"]
}

Rules:
- PAUSE = stop the agent immediately. Use only for clear exploitation patterns:
  draining sequences, new destinations + high amount, rapid escalation, known attack shapes.
- FLAG = log but allow. Unusual but not obviously malicious.
- ALLOW = routine activity consistent with policy and history.
Default to ALLOW when uncertain. False positives erode trust; only PAUSE on strong evidence.`;

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

export function buildJudgeUserMessage(ctx: JudgeContext): string {
  const historyLines = ctx.history
    .map(
      (h, i) =>
        `${i + 1}. ${h.program} | ${h.amountSol} SOL | ${h.status} | ${h.minsAgo}m ago`,
    )
    .join("\n");

  return `POLICY:
- Agent: ${ctx.policy.agent}
- Allowed programs: ${ctx.policy.allowedPrograms.join(", ")}
- Per-tx cap: ${ctx.policy.maxTxSol} SOL
- Daily budget: ${ctx.policy.dailyBudgetSol} SOL (${ctx.policy.dailyUsedPct}% used today)
- Session expires in: ${ctx.policy.minsToExpiry} minutes

CURRENT TRANSACTION:
- Target program: ${ctx.txn.program} ${ctx.txn.programLabel ? `(${ctx.txn.programLabel})` : "(UNKNOWN to this agent)"}
- Amount: ${ctx.txn.amountSol} SOL (${ctx.txn.pctOfCap}% of per-tx cap)
- Time: ${ctx.txn.timestamp}

RECENT HISTORY (last 20 txns):
${historyLines || "(no history)"}

AGENT BASELINE:
- Median tx amount: ${ctx.baseline.medianAmount} SOL
- p95 tx amount: ${ctx.baseline.p95Amount} SOL
- Typical active hours: ${ctx.baseline.activeHours}
- Programs used ever: ${ctx.baseline.uniqueProgramsCount}

PRE-FILTER SIGNALS: ${ctx.prefilterSignals.join(", ") || "none"}

Judge this transaction.`;
}

// ---------------------------------------------------------------------------
// Context builder — assembles JudgeContext from DB
// ---------------------------------------------------------------------------

const LAMPORTS_PER_SOL = 1_000_000_000;

function lamportsToSol(lamports: bigint | number | null): number {
  return Number(lamports ?? 0) / LAMPORTS_PER_SOL;
}

/** Well-known Solana program labels for prompt readability. */
const PROGRAM_LABELS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "Token Program",
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "Jupiter v6",
  MRNSSfWnd6m2BG3wm7MoKEiVDLeRFy7PJjDGSLr3mC6: "Marinade",
};

/**
 * Build the full JudgeContext for a transaction.
 * Queries the DB for policy, recent history, and baseline stats.
 */
export async function buildJudgeContext(
  row: GuardedTxn,
  prefilterSignals: string[],
): Promise<JudgeContext> {
  const now = new Date();

  // Fetch policy
  const policy = await prisma.policy.findUniqueOrThrow({
    where: { pubkey: row.policyPubkey },
  });

  // Recent 20 transactions (excluding current)
  const recentTxns = await prisma.guardedTxn.findMany({
    where: { policyPubkey: row.policyPubkey, id: { not: row.id } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Daily spend calculation
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const todayTxns = recentTxns.filter((t) => t.createdAt >= startOfDay);
  const dailySpent = todayTxns.reduce(
    (sum, t) => sum + Number(t.amountLamports ?? 0),
    0,
  );
  const dailyBudget = Number(policy.dailyBudgetLamports);
  const dailyUsedPct =
    dailyBudget > 0 ? Math.round((dailySpent / dailyBudget) * 100) : 0;

  // Baseline stats from all recent txns
  const amounts = recentTxns
    .map((t) => lamportsToSol(t.amountLamports))
    .filter((a) => a > 0)
    .sort((a, b) => a - b);

  const medianAmount =
    amounts.length > 0
      ? amounts[Math.floor(amounts.length / 2)]
      : 0;
  const p95Amount =
    amounts.length > 0
      ? amounts[Math.floor(amounts.length * 0.95)]
      : 0;

  // Active hours
  const hours = recentTxns.map((t) => t.createdAt.getUTCHours());
  const uniqueHours = [...new Set(hours)].sort((a, b) => a - b);
  const activeHours =
    uniqueHours.length > 0 ? `${uniqueHours[0]}–${uniqueHours[uniqueHours.length - 1]} UTC` : "unknown";

  // Unique programs
  const uniquePrograms = new Set(recentTxns.map((t) => t.targetProgram));

  // Minutes to session expiry
  const minsToExpiry = Math.max(
    0,
    Math.round((policy.sessionExpiry.getTime() - now.getTime()) / 60_000),
  );

  // Amount as SOL
  const amountSol = lamportsToSol(row.amountLamports);
  const maxTxSol = lamportsToSol(policy.maxTxLamports);
  const pctOfCap = maxTxSol > 0 ? Math.round((amountSol / maxTxSol) * 100) : 0;

  // Check if this program is in the allow-list for labeling
  const programLabel =
    PROGRAM_LABELS[row.targetProgram] ??
    (policy.allowedPrograms.includes(row.targetProgram) ? "whitelisted" : undefined);

  return {
    policy: {
      agent: policy.agent,
      allowedPrograms: policy.allowedPrograms,
      maxTxSol: Math.round(maxTxSol * 1000) / 1000,
      dailyBudgetSol: Math.round(lamportsToSol(policy.dailyBudgetLamports) * 1000) / 1000,
      dailyUsedPct,
      minsToExpiry,
    },
    txn: {
      program: row.targetProgram,
      programLabel,
      amountSol: Math.round(amountSol * 1000000) / 1000000,
      pctOfCap,
      timestamp: row.blockTime.toISOString(),
    },
    history: recentTxns.map((t) => ({
      program: t.targetProgram,
      amountSol: Math.round(lamportsToSol(t.amountLamports) * 1000000) / 1000000,
      status: t.status,
      minsAgo: Math.round((now.getTime() - t.createdAt.getTime()) / 60_000),
    })),
    baseline: {
      medianAmount: Math.round(medianAmount * 1000000) / 1000000,
      p95Amount: Math.round(p95Amount * 1000000) / 1000000,
      activeHours,
      uniqueProgramsCount: uniquePrograms.size,
    },
    prefilterSignals,
  };
}
