// Ingest stage — parses a Helius enhanced transaction, persists a GuardedTxn row,
// and emits the new_transaction SSE event.

import { prisma } from "../../db/client.js";
import { sseEmitter } from "../../sse/emitter.js";
import { env } from "../../config/env.js";
import type { HeliusEnhancedTransaction } from "../routes/webhook.js";
import type { GuardedTxn } from "@prisma/client";

/** Rejection reason codes matching on-chain GuardedTxnRejected event. */
const REJECT_REASONS: Record<number, string> = {
  0: "PolicyPaused",
  1: "SessionExpired",
  2: "ProgramNotWhitelisted",
  3: "AmountExceeds",
  4: "DailyBudgetExceeded",
};

/**
 * Extract the policy pubkey from a Guardrails program instruction.
 * In the Anchor account layout for guarded_execute, the policy PDA is the first account.
 */
function extractPolicyPubkey(txn: HeliusEnhancedTransaction): string | null {
  const programId = env.GUARDRAILS_PROGRAM_ID;

  for (const ix of txn.instructions) {
    if (ix.programId === programId && ix.accounts.length > 0) {
      return ix.accounts[0];
    }
  }

  return null;
}

/**
 * Extract the target program from the CPI inner instructions.
 * The guardrails program CPIs to the target — look for inner instructions
 * under the guardrails instruction that call a different program.
 */
function extractTargetProgram(txn: HeliusEnhancedTransaction): string {
  const programId = env.GUARDRAILS_PROGRAM_ID;

  for (const ix of txn.instructions) {
    if (ix.programId === programId && ix.innerInstructions) {
      for (const inner of ix.innerInstructions) {
        if (inner.programId !== programId) {
          return inner.programId;
        }
      }
    }
  }

  // Fallback: use the type field from Helius or "unknown"
  return txn.type || "unknown";
}

/**
 * Extract the SOL amount from native transfers in the transaction.
 * Sums transfers originating from the fee payer (agent) excluding fee.
 */
function extractAmountLamports(txn: HeliusEnhancedTransaction): bigint | null {
  if (!txn.nativeTransfers || txn.nativeTransfers.length === 0) return null;

  // Sum all native transfers from the fee payer (agent), excluding fee payments
  const agentTransfers = txn.nativeTransfers.filter(
    (t) => t.fromUserAccount === txn.feePayer && t.amount > 0,
  );

  if (agentTransfers.length === 0) return null;

  const total = agentTransfers.reduce((sum, t) => sum + t.amount, 0);
  return BigInt(total);
}

/**
 * Determine transaction status from the Helius enhanced transaction.
 */
function extractStatus(txn: HeliusEnhancedTransaction): { status: string; rejectReason: string | null } {
  if (txn.transactionError) {
    // Try to extract the rejection reason from the error
    const errStr = typeof txn.transactionError === "string"
      ? txn.transactionError
      : JSON.stringify(txn.transactionError);

    // Check for known rejection reason codes
    for (const [code, reason] of Object.entries(REJECT_REASONS)) {
      if (errStr.includes(reason) || errStr.includes(code)) {
        return { status: "rejected", rejectReason: reason };
      }
    }

    return { status: "rejected", rejectReason: errStr.slice(0, 256) };
  }

  return { status: "executed", rejectReason: null };
}

/**
 * Ingest a single Helius enhanced transaction into the database.
 * Returns the created GuardedTxn row (used by downstream pipeline stages).
 */
export async function ingest(txn: HeliusEnhancedTransaction): Promise<GuardedTxn | null> {
  const policyPubkey = extractPolicyPubkey(txn);

  if (!policyPubkey) {
    console.warn(`[ingest] no policy found in txn ${txn.signature}, skipping`);
    return null;
  }

  // Verify the policy exists in our database
  const policy = await prisma.policy.findUnique({ where: { pubkey: policyPubkey } });
  if (!policy) {
    console.warn(`[ingest] unknown policy ${policyPubkey} in txn ${txn.signature}, skipping`);
    return null;
  }

  const targetProgram = extractTargetProgram(txn);
  const amountLamports = extractAmountLamports(txn);
  const { status, rejectReason } = extractStatus(txn);

  // Upsert to handle duplicate webhook deliveries (Helius guarantees at-least-once)
  const row = await prisma.guardedTxn.upsert({
    where: { txnSig: txn.signature },
    update: {},
    create: {
      policyPubkey,
      txnSig: txn.signature,
      slot: BigInt(txn.slot),
      blockTime: new Date(txn.timestamp * 1000),
      targetProgram,
      amountLamports,
      status,
      rejectReason,
      rawEvent: JSON.parse(JSON.stringify(txn)),
    },
  });

  // Emit SSE event with bigint fields serialized as strings
  sseEmitter.emitEvent("new_transaction", {
    id: row.id,
    policyPubkey: row.policyPubkey,
    txnSig: row.txnSig,
    slot: row.slot.toString(),
    blockTime: row.blockTime,
    targetProgram: row.targetProgram,
    amountLamports: row.amountLamports?.toString() ?? null,
    status: row.status,
    rejectReason: row.rejectReason,
    rawEvent: row.rawEvent,
    createdAt: row.createdAt,
  });

  console.log(`[ingest] ${status} txn ${txn.signature.slice(0, 16)}… policy=${policyPubkey.slice(0, 8)}… amount=${amountLamports ?? "n/a"}`);

  return row;
}
