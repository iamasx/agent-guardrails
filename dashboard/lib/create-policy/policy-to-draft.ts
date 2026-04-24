import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { PolicySummary } from "@/lib/types/dashboard";
import type { CreatePolicyDraftInput } from "./validate";

export function policySummaryToDraft(policy: PolicySummary): CreatePolicyDraftInput {
  const maxTxSol = Number(policy.maxTxLamports) / LAMPORTS_PER_SOL;
  const dailyBudgetSol = Number(policy.dailyBudgetLamports) / LAMPORTS_PER_SOL;
  const expiryMs = new Date(policy.sessionExpiry).getTime();
  const sessionDays = Math.min(
    90,
    Math.max(1, Math.ceil((expiryMs - Date.now()) / 86_400_000)),
  );
  const squads = policy.squadsMultisig;
  const escalationEnabled = Boolean(squads);
  return {
    allowedPrograms: [...policy.allowedPrograms],
    maxTxSol,
    dailyBudgetSol,
    sessionDays,
    escalationEnabled,
    squadsMultisig: squads ?? "",
    escalationThresholdSol: policy.escalationThreshold
      ? Number(policy.escalationThreshold) / LAMPORTS_PER_SOL
      : 0,
  };
}
