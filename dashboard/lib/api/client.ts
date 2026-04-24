import { INCIDENTS, POLICIES, TRANSACTIONS, VERDICTS } from "@/lib/mock";
import type {
  ApiErrorPayload,
  ApiListResponse,
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
const DEFAULT_TRANSACTIONS_LIMIT = 50;
const DEFAULT_INCIDENTS_LIMIT = 25;
const DEFAULT_ERROR_MESSAGE = "Something went wrong while contacting the API.";

export function buildApiRequestInit(init?: RequestInit): RequestInit {
  return {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  };
}

function normalizeLimit(limit: number, fallback: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return fallback;
  }
  return Math.floor(limit);
}

function toQueryString(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function getJson<T>(path: string): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await fetch(`${API_URL}${path}`, buildApiRequestInit());

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    let errorMessage = "";
    try {
      payload = (await response.json()) as ApiErrorPayload;
      errorMessage = payload.error ?? payload.message ?? "";
    } catch {
      errorMessage = await response.text().catch(() => "");
    }
    throw new ApiClientError(response.status, errorMessage || DEFAULT_ERROR_MESSAGE, payload);
  }

  return response.json() as Promise<T>;
}

export class ApiClientError extends Error {
  status: number;
  payload: ApiErrorPayload | null;

  constructor(status: number, message: string, payload: ApiErrorPayload | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

export function getErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
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

function normalizePaginatedResponse<T extends { id: string }>(
  response: ApiListResponse<T>,
  limit: number,
): PaginatedResponse<T> {
  if (Array.isArray(response)) {
    return paginate(response, undefined, limit);
  }
  return response;
}

function normalizeIncidentDetail(detail: IncidentDetail): IncidentDetail {
  return {
    ...detail,
    judgeVerdict: detail.judgeVerdict
      ? {
          ...detail.judgeVerdict,
          signals: detail.judgeVerdict.signals ?? [],
        }
      : null,
  };
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
  limit = DEFAULT_TRANSACTIONS_LIMIT,
): Promise<PaginatedResponse<TransactionSummary>> {
  const safeLimit = normalizeLimit(limit, DEFAULT_TRANSACTIONS_LIMIT);
  if (!USE_MOCK_API) {
    const params = new URLSearchParams();
    if (policyPubkey) params.set("policy", policyPubkey);
    if (before) params.set("before", before);
    params.set("limit", String(safeLimit));
    const response = await getJson<ApiListResponse<TransactionSummary>>(
      `/api/transactions${toQueryString(params)}`,
    );
    return normalizePaginatedResponse(response, safeLimit);
  }

  const filtered = sortTransactions(buildTransactions()).filter((transaction) =>
    policyPubkey ? transaction.policyPubkey === policyPubkey : true,
  );
  return paginate(filtered, before, safeLimit);
}

export async function fetchIncidents(
  policyPubkey?: string,
  before?: string,
  limit = DEFAULT_INCIDENTS_LIMIT,
): Promise<PaginatedResponse<IncidentSummary>> {
  const safeLimit = normalizeLimit(limit, DEFAULT_INCIDENTS_LIMIT);
  if (!USE_MOCK_API) {
    const params = new URLSearchParams();
    if (policyPubkey) params.set("policy", policyPubkey);
    if (before) params.set("before", before);
    params.set("limit", String(safeLimit));
    const response = await getJson<ApiListResponse<IncidentSummary>>(`/api/incidents${toQueryString(params)}`);
    return normalizePaginatedResponse(response, safeLimit);
  }

  const filtered = sortIncidents(INCIDENTS).filter((incident) =>
    policyPubkey ? incident.policyPubkey === policyPubkey : true,
  );
  return paginate(filtered, before, safeLimit);
}

export async function fetchIncident(id: string): Promise<IncidentDetail> {
  if (!USE_MOCK_API) {
    const detail = await getJson<IncidentDetail>(`/api/incidents/${id}`);
    return normalizeIncidentDetail(detail);
  }

  const incident = INCIDENTS.find((item) => item.id === id);
  if (!incident) {
    throw new Error("Incident not found");
  }

  const policy = POLICIES.find((item) => item.pubkey === incident.policyPubkey);
  const judgeVerdict = incident.judgeVerdictId
    ? VERDICTS.find((item) => item.id === incident.judgeVerdictId) ?? null
    : null;

  return normalizeIncidentDetail({
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
  });
}
