// POST /webhook — Helius Enhanced Transaction webhook receiver.
// Verifies HMAC-SHA256 signature, parses transaction array, dispatches to pipeline.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { ingest } from "../pipeline/ingest.js";
import { prefilter } from "../pipeline/prefilter.js";
import { judgeTransaction } from "../pipeline/judge.js";

/**
 * Verify the Helius webhook signature.
 * Helius sends the HMAC-SHA256 of the raw body in the Authorization header.
 */
function verifySignature(rawBody: Buffer, authHeader: string | undefined): boolean {
  if (!authHeader) return false;

  const expected = createHmac("sha256", env.HELIUS_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");

  // Constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(expected),
    );
  } catch {
    // Buffers of different length throw — signature is invalid
    return false;
  }
}

/**
 * Helius Enhanced Transaction shape (subset of fields we use).
 * Full spec: https://docs.helius.dev/webhooks-and-websockets/what-are-webhooks
 */
export interface HeliusEnhancedTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  type: string;
  fee: number;
  feePayer: string;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
  }>;
  instructions: Array<{
    programId: string;
    accounts: string[];
    data: string;
    innerInstructions: Array<{
      programId: string;
      accounts: string[];
      data: string;
    }>;
  }>;
  events: Record<string, unknown>;
  transactionError: unknown;
  accountData: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: unknown[];
  }>;
}

/**
 * POST /webhook handler.
 * Returns 200 immediately after dispatching to pipeline — never blocks Helius retries.
 */
export async function webhookHandler(req: Request, res: Response): Promise<void> {
  // The raw body buffer is stored by the verify callback in worker/index.ts
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!rawBody || !verifySignature(rawBody, req.headers.authorization)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const transactions: HeliusEnhancedTransaction[] = req.body;

  if (!Array.isArray(transactions)) {
    res.status(400).json({ error: "Expected array of transactions" });
    return;
  }

  // Respond immediately — pipeline runs async
  res.status(200).json({ received: transactions.length });

  // Process each transaction through the pipeline
  for (const txn of transactions) {
    try {
      const row = await ingest(txn);
      if (!row) continue;

      // Prefilter: cheap stat checks — skip LLM if clearly benign
      const { signals, skipped } = await prefilter(row);
      if (skipped) continue;

      // Judge: Claude Haiku evaluates the transaction
      const verdict = await judgeTransaction(row, signals);

      // Phase 4 will add: if verdict.verdict === "pause" → executor → reporter
      void verdict;
    } catch (err) {
      console.error(`[webhook] pipeline error for ${txn.signature}:`, err);
    }
  }
}
