// Prefilter stage — cheap stat checks before invoking the LLM judge.
// Returns an array of signal strings. Empty array = skip LLM (clearly benign).

import { prisma } from "../../db/client.js";
import { sseEmitter } from "../../sse/emitter.js";
import type { GuardedTxn } from "@prisma/client";

/** Result of the prefilter stage. */
export interface PrefilterResult {
  /** Signal strings describing why the LLM should be invoked. Empty = skip. */
  signals: string[];
  /** If signals is empty, a prefilter-skipped allow verdict was already recorded. */
  skipped: boolean;
}

/**
 * Run prefilter checks against recent transaction history.
 * If no signals are raised, records an automatic "allow" verdict and returns skipped=true.
 */
export async function prefilter(row: GuardedTxn): Promise<PrefilterResult> {
  const signals = await computeSignals(row);

  if (signals.length === 0) {
    // Record prefilter-skipped allow verdict
    const verdict = await prisma.anomalyVerdict.create({
      data: {
        txnId: row.id,
        policyPubkey: row.policyPubkey,
        verdict: "allow",
        confidence: 90,
        reasoning: "Prefilter: all checks passed, LLM skipped",
        model: "prefilter",
        prefilterSkipped: true,
      },
    });

    sseEmitter.emitEvent("verdict", {
      ...verdict,
      latencyMs: verdict.latencyMs,
      promptTokens: verdict.promptTokens,
      completionTokens: verdict.completionTokens,
      signals: [],
    });

    return { signals: [], skipped: true };
  }

  return { signals, skipped: false };
}

// ---------------------------------------------------------------------------
// Signal computation
// ---------------------------------------------------------------------------

async function computeSignals(row: GuardedTxn): Promise<string[]> {
  const signals: string[] = [];
  const now = new Date();

  // Fetch recent txns for this policy (last 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentTxns = await prisma.guardedTxn.findMany({
    where: {
      policyPubkey: row.policyPubkey,
      createdAt: { gte: sevenDaysAgo },
      id: { not: row.id },
    },
    orderBy: { createdAt: "desc" },
  });

  // 1. Most-used program check
  const programCounts: Record<string, number> = {};
  for (const t of recentTxns) {
    programCounts[t.targetProgram] = (programCounts[t.targetProgram] || 0) + 1;
  }
  const mostUsed = Object.entries(programCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (mostUsed && row.targetProgram !== mostUsed) {
    signals.push("new_or_uncommon_program");
  }

  // 2. Burst detection: txns in last 60 seconds
  const oneMinAgo = new Date(now.getTime() - 60_000);
  const recentBurst = recentTxns.filter((t) => t.createdAt > oneMinAgo);
  if (recentBurst.length >= 5) signals.push("burst_detected");
  else if (recentBurst.length >= 3) signals.push("elevated_frequency");

  // 3-5. Policy-dependent checks
  const policy = await prisma.policy.findUnique({
    where: { pubkey: row.policyPubkey },
  });

  if (policy) {
    // 3. Amount > 70% of per-tx cap
    const amount = Number(row.amountLamports ?? 0);
    const maxTx = Number(policy.maxTxLamports);
    if (maxTx > 0) {
      const pctOfCap = (amount / maxTx) * 100;
      if (pctOfCap > 70) signals.push("high_amount");
    }

    // 4. Daily budget > 80% used
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const todayTxns = recentTxns.filter((t) => t.createdAt >= startOfDay);
    const dailySpent = todayTxns.reduce(
      (sum, t) => sum + Number(t.amountLamports ?? 0),
      0,
    );
    const dailyBudget = Number(policy.dailyBudgetLamports);
    if (dailyBudget > 0 && dailySpent / dailyBudget > 0.8) {
      signals.push("budget_nearly_exhausted");
    }

    // 5. Session expiring within 10 minutes
    const minsToExpiry =
      (policy.sessionExpiry.getTime() - now.getTime()) / 60_000;
    if (minsToExpiry < 10) signals.push("session_expiring_soon");
  }

  // 6. Outside active hours (±2h from median)
  const hours = recentTxns.map((t) => t.createdAt.getUTCHours());
  if (hours.length > 0) {
    const sorted = [...hours].sort((a, b) => a - b);
    const medianHour = sorted[Math.floor(sorted.length / 2)];
    const currentHour = now.getUTCHours();
    const diff = Math.abs(currentHour - medianHour);
    // Handle wrap-around (e.g., hour 23 vs hour 1 = 2h diff, not 22)
    if (Math.min(diff, 24 - diff) > 2) signals.push("outside_active_hours");
  }

  return signals;
}
