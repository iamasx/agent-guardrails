import { INCIDENTS, POLICIES, TRANSACTIONS, VERDICTS } from "@/lib/mock";
import type {
  IncidentDetail,
  IncidentSummary,
  PaginatedResponse,
  PolicySummary,
  TransactionSummary,
  VerdictSummary,
} from "@/lib/types/dashboard";

function buildVerdictMap(): Map<string, VerdictSummary> {
  return new Map(
    VERDICTS.map((verdict) => [
      verdict.txnId,
      {
        ...verdict,
        signals: [],
      },
    ]),
  );
}

const verdictByTxnId = buildVerdictMap();

function buildTransactions(): TransactionSummary[] {
  return TRANSACTIONS.map((transaction) => ({
    ...transaction,
    verdict: verdictByTxnId.get(transaction.id) ?? null,
  }));
}

function sortPolicies(items: PolicySummary[]): PolicySummary[] {
  return [...items].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function sortTransactions(items: TransactionSummary[]): TransactionSummary[] {
  return [...items].sort(
    (left, right) => new Date(right.blockTime).getTime() - new Date(left.blockTime).getTime(),
  );
}

function sortIncidents(items: IncidentSummary[]): IncidentSummary[] {
  return [...items].sort(
    (left, right) => new Date(right.pausedAt).getTime() - new Date(left.pausedAt).getTime(),
  );
}

function paginate<T extends { id: string }>(items: T[], before?: string, limit = 50): PaginatedResponse<T> {
  const startIndex = before ? items.findIndex((item) => item.id === before) + 1 : 0;
  const page = items.slice(Math.max(startIndex, 0), Math.max(startIndex, 0) + limit);
  const nextCursor = startIndex + limit < items.length ? page[page.length - 1]?.id ?? null : null;
  return {
    items: page,
    nextCursor,
  };
}

export async function requestSiwsNonce(walletPubkey: string): Promise<{ nonce: string; message: string }> {
  const nonce = "mock-dashboard-nonce";
  return {
    nonce,
    message: [
      "Agent Guardrails Dashboard",
      "",
      `Wallet: ${walletPubkey}`,
      `Nonce: ${nonce}`,
      "Sign this message to verify wallet ownership.",
    ].join("\n"),
  };
}

export async function verifySiwsSignature(payload: {
  walletPubkey: string;
  message: string;
  signature: string;
}): Promise<{ ok: boolean; walletPubkey: string }> {
  if (!payload.signature) {
    throw new Error("Missing signature");
  }
  return { ok: true, walletPubkey: payload.walletPubkey };
}

export async function fetchPolicies(): Promise<PolicySummary[]> {
  return sortPolicies(POLICIES);
}

export async function fetchTransactions(
  policyPubkey?: string,
  before?: string,
  limit = 50,
): Promise<PaginatedResponse<TransactionSummary>> {
  const filtered = sortTransactions(buildTransactions()).filter((transaction) =>
    policyPubkey ? transaction.policyPubkey === policyPubkey : true,
  );
  return paginate(filtered, before, limit);
}

export async function fetchIncidents(
  policyPubkey?: string,
  before?: string,
  limit = 25,
): Promise<PaginatedResponse<IncidentSummary>> {
  const filtered = sortIncidents(INCIDENTS).filter((incident) =>
    policyPubkey ? incident.policyPubkey === policyPubkey : true,
  );
  return paginate(filtered, before, limit);
}

export async function fetchIncident(id: string): Promise<IncidentDetail> {
  const incident = INCIDENTS.find((item) => item.id === id);
  if (!incident) {
    throw new Error("Incident not found");
  }

  const policy = POLICIES.find((item) => item.pubkey === incident.policyPubkey);
  const judgeVerdict = incident.judgeVerdictId
    ? VERDICTS.find((item) => item.id === incident.judgeVerdictId) ?? null
    : null;

  return {
    ...incident,
    policy: {
      pubkey: policy?.pubkey ?? incident.policyPubkey,
      label: policy?.label ?? null,
      isActive: policy?.isActive ?? false,
    },
    judgeVerdict: judgeVerdict
      ? {
          ...judgeVerdict,
          signals: [],
        }
      : null,
  };
}
