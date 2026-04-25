// Judge stage — calls the active LLM provider to evaluate a flagged transaction.
// Handles timeout (3s), retry on 429, and rule-based fallback.

import { prisma } from "../../db/client.js";
import { sseEmitter } from "../../sse/emitter.js";
import { llmCall, llmProviderName } from "../../config/llm.js";
import {
  JUDGE_SYSTEM,
  buildJudgeUserMessage,
  buildJudgeContext,
} from "../prompts/judge.js";
import type { Verdict } from "../../types/anomaly.js";
import type { GuardedTxn } from "@prisma/client";

const JUDGE_TIMEOUT_MS = 3_000;
const RETRY_DELAY_MS = 1_000;

/**
 * Judge a transaction that passed prefilter with signals.
 * Returns the parsed verdict (allow/flag/pause).
 */
export async function judgeTransaction(
  row: GuardedTxn,
  prefilterSignals: string[],
): Promise<Verdict> {
  const ctx = await buildJudgeContext(row, prefilterSignals);
  const userMessage = buildJudgeUserMessage(ctx);

  let verdict: Verdict;
  let latencyMs: number;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let model: string = llmProviderName;

  try {
    const result = await callWithTimeout(userMessage);
    verdict = result.verdict;
    latencyMs = result.latencyMs;
    promptTokens = result.promptTokens;
    completionTokens = result.completionTokens;
    model = result.model;
  } catch (err) {
    // Rate limit — retry once after delay
    if (isRateLimitError(err)) {
      try {
        await delay(RETRY_DELAY_MS);
        const result = await callWithTimeout(userMessage);
        verdict = result.verdict;
        latencyMs = result.latencyMs;
        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;
        model = result.model;
      } catch {
        verdict = fallbackVerdict(prefilterSignals);
        latencyMs = JUDGE_TIMEOUT_MS;
        model = "fallback";
      }
    } else {
      verdict = fallbackVerdict(prefilterSignals);
      latencyMs = JUDGE_TIMEOUT_MS;
      model = "fallback";
    }
  }

  // Persist verdict
  const row2 = await prisma.anomalyVerdict.create({
    data: {
      txnId: row.id,
      policyPubkey: row.policyPubkey,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
      model,
      latencyMs,
      prefilterSkipped: false,
      promptTokens: promptTokens ?? null,
      completionTokens: completionTokens ?? null,
    },
  });

  // Emit SSE
  sseEmitter.emitEvent("verdict", {
    ...row2,
    signals: verdict.signals,
  });

  console.log(
    `[judge] ${verdict.verdict} (${verdict.confidence}%) txn=${row.txnSig.slice(0, 16)}… model=${model} latency=${latencyMs}ms`,
  );

  return verdict;
}

// ---------------------------------------------------------------------------
// LLM call with timeout
// ---------------------------------------------------------------------------

interface CallResult {
  verdict: Verdict;
  model: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

async function callWithTimeout(userMessage: string): Promise<CallResult> {
  const start = Date.now();

  const response = await Promise.race([
    llmCall({
      system: JUDGE_SYSTEM,
      userMessage,
      maxTokens: 256,
      tier: "fast",
    }),
    timeoutPromise(JUDGE_TIMEOUT_MS),
  ]);

  const latencyMs = Date.now() - start;

  // Strip code fences and parse JSON
  const cleaned = response.text.replace(/```json\s*|```\s*/g, "").trim();
  let parsed: Verdict;
  try {
    parsed = JSON.parse(cleaned) as Verdict;
  } catch {
    parsed = {
      verdict: "flag",
      confidence: 40,
      reasoning: "Malformed judge response — defaulting to flag",
      signals: ["malformed_response"],
    };
  }

  parsed.confidence = Math.max(0, Math.min(100, parsed.confidence));

  return {
    verdict: parsed,
    model: response.model,
    latencyMs,
    promptTokens: response.promptTokens,
    completionTokens: response.completionTokens,
  };
}

// ---------------------------------------------------------------------------
// Fallback verdict (rule-based)
// ---------------------------------------------------------------------------

function fallbackVerdict(signals: string[]): Verdict {
  if (signals.includes("burst_detected")) {
    return {
      verdict: "pause",
      confidence: 50,
      reasoning: "LLM timeout — burst detected, pausing as precaution",
      signals: ["fallback", "burst_detected"],
    };
  }

  return {
    verdict: "flag",
    confidence: 50,
    reasoning: "LLM timeout — flagging for manual review",
    signals: ["fallback"],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms),
  );
}

function isRateLimitError(err: unknown): boolean {
  return (
    err instanceof Error &&
    ("status" in err && (err as { status: number }).status === 429)
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
