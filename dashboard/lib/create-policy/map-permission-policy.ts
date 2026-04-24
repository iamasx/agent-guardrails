import { PublicKey } from "@solana/web3.js";
import type { PermissionPolicy } from "@/lib/sdk/types";
import type { PolicySummary } from "@/lib/types/dashboard";

const DEFAULT_PUBKEY = new PublicKey(new Uint8Array(32));

/** Map on-chain account to dashboard PolicySummary (API / mock shape). */
export function permissionPolicyToSummary(
  policyPubkey: string,
  account: PermissionPolicy,
  nowIso = new Date().toISOString(),
): PolicySummary {
  const sessionExpiryUnix = account.sessionExpiry.toNumber();
  const squadsPk = account.squadsMultisig;

  return {
    pubkey: policyPubkey,
    owner: account.owner.toBase58(),
    agent: account.agent.toBase58(),
    allowedPrograms: account.allowedPrograms.map((p) => p.toBase58()),
    maxTxLamports: account.maxTxLamports.toString(),
    dailyBudgetLamports: account.dailyBudgetLamports.toString(),
    dailySpentLamports: account.dailySpentLamports.toString(),
    sessionExpiry: new Date(sessionExpiryUnix * 1000).toISOString(),
    isActive: account.isActive,
    squadsMultisig:
      squadsPk && !squadsPk.equals(DEFAULT_PUBKEY) ? squadsPk.toBase58() : null,
    escalationThreshold: account.escalationThreshold.isZero()
      ? null
      : account.escalationThreshold.toString(),
    anomalyScore: account.anomalyScore,
    label: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
