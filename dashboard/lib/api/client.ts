import { INCIDENTS, POLICIES, TRANSACTIONS, VERDICTS } from "@/lib/mock";
import type {
  IncidentDetail,
  IncidentSummary,
  PaginatedResponse,
  PolicySummary,
  TransactionSummary,
  VerdictSummary,
} from "@/lib/types/dashboard";
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true" || !API_URL;
export const apiMode = USE_MOCK_API ? "mock" : "http";

async function getJson<T>(path: string): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status})${body ? `: ${body}` : ""}`);
  }

  return response.json() as Promise<T>;
}

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
  if (!USE_MOCK_API) {
    return getJson<PolicySummary[]>("/api/policies");
  }
  return sortPolicies(POLICIES);
}

export async function fetchPolicy(pubkey: string): Promise<PolicySummary> {
  if (!USE_MOCK_API) {
    return getJson<PolicySummary>(`/api/policies/${pubkey}`);
  }

  const policy = POLICIES.find((item) => item.pubkey === pubkey);
  if (!policy) {
    throw new Error("Policy not found");
  }
  return policy;
}

export async function fetchTransactions(
  policyPubkey?: string,
  before?: string,
  limit = 50,
): Promise<PaginatedResponse<TransactionSummary>> {
  if (!USE_MOCK_API) {
    const params = new URLSearchParams();
    if (policyPubkey) params.set("policy", policyPubkey);
    if (before) params.set("before", before);
    if (limit) params.set("limit", String(limit));
    return getJson<PaginatedResponse<TransactionSummary>>(`/api/transactions?${params.toString()}`);
  }

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
  if (!USE_MOCK_API) {
    const params = new URLSearchParams();
    if (policyPubkey) params.set("policy", policyPubkey);
    if (before) params.set("before", before);
    if (limit) params.set("limit", String(limit));
    return getJson<PaginatedResponse<IncidentSummary>>(`/api/incidents?${params.toString()}`);
  }

  const filtered = sortIncidents(INCIDENTS).filter((incident) =>
    policyPubkey ? incident.policyPubkey === policyPubkey : true,
  );
  return paginate(filtered, before, limit);
}

export async function fetchIncident(id: string): Promise<IncidentDetail> {
  if (!USE_MOCK_API) {
    return getJson<IncidentDetail>(`/api/incidents/${id}`);
  }

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
