import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import type { InitializePolicyArgs } from "@/lib/sdk/types";
import type { CreatePolicyDraftInput } from "./validate";

/** Parse monitor pubkeys from env (comma-separated). Max 3. Skips invalid entries. */
export function parseAuthorizedMonitorsFromEnv(): PublicKey[] {
  if (typeof process === "undefined") return [];
  const raw =
    process.env.NEXT_PUBLIC_AUTHORIZED_MONITORS ??
    process.env.NEXT_PUBLIC_MONITOR_PUBKEY ??
    "";
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const keys: PublicKey[] = [];
  for (const p of parts) {
    try {
      keys.push(new PublicKey(p));
    } catch {
      // skip invalid
    }
    if (keys.length >= 3) break;
  }
  return keys;
}

export function buildInitializePolicyArgs(draft: CreatePolicyDraftInput): InitializePolicyArgs {
  const maxTxLamports = new BN(Math.floor(draft.maxTxSol * LAMPORTS_PER_SOL));
  const dailyBudgetLamports = new BN(Math.floor(draft.dailyBudgetSol * LAMPORTS_PER_SOL));
  const sessionExpiryMs = Date.now() + draft.sessionDays * 86_400_000;
  const sessionExpiry = new BN(Math.floor(sessionExpiryMs / 1000));

  const allowedPrograms = draft.allowedPrograms.map((s) => new PublicKey(s));

  let squadsMultisig: PublicKey | null = null;
  let escalationThreshold = new BN(0);
  if (draft.escalationEnabled) {
    squadsMultisig = new PublicKey(draft.squadsMultisig.trim());
    escalationThreshold = new BN(Math.floor(draft.escalationThresholdSol * LAMPORTS_PER_SOL));
  }

  const authorizedMonitors = parseAuthorizedMonitorsFromEnv();

  return {
    allowedPrograms,
    maxTxLamports,
    // Demo: mirror lamport cap as raw SPL token units (see walkthrough).
    maxTxTokenUnits: maxTxLamports,
    dailyBudgetLamports,
    sessionExpiry,
    squadsMultisig,
    escalationThreshold,
    authorizedMonitors,
  };
}
