// Judge stage — calls Claude Haiku to evaluate a flagged transaction.
// Handles timeout (3s), retry on 429, and rule-based fallback.

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../db/client.js";
import { sseEmitter } from "../../sse/emitter.js";
import { env } from "../../config/env.js";
import {
  JUDGE_SYSTEM,
  buildJudgeUserMessage,
  buildJudgeContext,
} from "../prompts/judge.js";
import type { Verdict } from "../../types/anomaly.js";
import type { GuardedTxn } from "@prisma/client";

const JUDGE_TIMEOUT_MS = 3_000;
const RETRY_DELAY_MS = 1_000;

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

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
  let model = "claude-haiku-4-5";

  try {
    const result = await callWithTimeout(userMessage);
    verdict = result.verdict;
    latencyMs = result.latencyMs;
    promptTokens = result.promptTokens;
    completionTokens = result.completionTokens;
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
      } catch {
        // Retry also failed — use fallback
        const fb = fallbackVerdict(prefilterSignals);
        verdict = fb;
        latencyMs = JUDGE_TIMEOUT_MS;
        model = "fallback";
      }
    } else {
      // Timeout, server error, or malformed response — fallback
      const fb = fallbackVerdict(prefilterSignals);
      verdict = fb;
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
// Claude API call with timeout
// ---------------------------------------------------------------------------

interface CallResult {
  verdict: Verdict;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

async function callWithTimeout(userMessage: string): Promise<CallResult> {
  const start = Date.now();

  const response = (await Promise.race([
    anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    }),
    timeoutPromise(JUDGE_TIMEOUT_MS),
  ])) as Anthropic.Message;

  const latencyMs = Date.now() - start;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Strip code fences and parse JSON
  const cleaned = textBlock.text.replace(/```json\s*|```\s*/g, "").trim();
  let parsed: Verdict;
  try {
    parsed = JSON.parse(cleaned) as Verdict;
  } catch {
    // Malformed JSON — treat as flag with low confidence
    parsed = {
      verdict: "flag",
      confidence: 40,
      reasoning: "Malformed judge response — defaulting to flag",
      signals: ["malformed_response"],
    };
  }

  // Clamp confidence to valid range
  parsed.confidence = Math.max(0, Math.min(100, parsed.confidence));

  return {
    verdict: parsed,
    latencyMs,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
  };
}

// ---------------------------------------------------------------------------
// Fallback verdict (rule-based)
// ---------------------------------------------------------------------------

function fallbackVerdict(signals: string[]): Verdict {
  // If burst detected, pause as a precaution
  if (signals.includes("burst_detected")) {
    return {
      verdict: "pause",
      confidence: 50,
      reasoning: "Claude timeout — burst detected, pausing as precaution",
      signals: ["fallback", "burst_detected"],
    };
  }

  // Otherwise flag for manual review
  return {
    verdict: "flag",
    confidence: 50,
    reasoning: "Claude timeout — flagging for manual review",
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
    err instanceof Anthropic.RateLimitError ||
    (err instanceof Error && "status" in err && (err as { status: number }).status === 429)
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
