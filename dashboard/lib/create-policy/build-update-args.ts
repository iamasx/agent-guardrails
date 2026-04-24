import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { UpdatePolicyArgs } from "@/lib/sdk/types";
import { buildInitializePolicyArgs } from "./build-args";
import type { CreatePolicyDraftInput } from "./validate";

const ZERO_PUBKEY = new PublicKey(new Uint8Array(32));

/** Full replace of updatable policy fields (matches create wizard semantics). */
export function buildUpdatePolicyFullReplace(draft: CreatePolicyDraftInput): UpdatePolicyArgs {
  const init = buildInitializePolicyArgs(draft);
  const squadsMultisig = draft.escalationEnabled ? init.squadsMultisig! : ZERO_PUBKEY;
  const escalationThreshold = draft.escalationEnabled
    ? init.escalationThreshold
    : new BN(0);

  return {
    allowedPrograms: init.allowedPrograms,
    maxTxLamports: init.maxTxLamports,
    maxTxTokenUnits: init.maxTxTokenUnits,
    dailyBudgetLamports: init.dailyBudgetLamports,
    sessionExpiry: init.sessionExpiry,
    squadsMultisig,
    escalationThreshold,
    authorizedMonitors: init.authorizedMonitors,
    anomalyScore: null,
  };
}
