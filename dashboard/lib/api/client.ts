import { INCIDENTS, POLICIES, TRANSACTIONS, VERDICTS } from "@/lib/mock";
import type {
  ApiErrorPayload,
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
const NETWORK_ERROR_MESSAGE = "Unable to reach the API server. Check NEXT_PUBLIC_API_URL and ensure the server is running.";

export function buildApiRequestInit(init?: RequestInit): RequestInit {
  const { headers: initHeaders, credentials: _ignored, ...rest } = init ?? {};
  const headers = new Headers({ Accept: "application/json" });
  if (initHeaders instanceof Headers) {
    initHeaders.forEach((value, key) => headers.set(key, value));
  } else if (Array.isArray(initHeaders)) {
    for (const [key, value] of initHeaders) {
      headers.set(key, value);
    }
  } else if (initHeaders && typeof initHeaders === "object") {
    for (const [key, value] of Object.entries(initHeaders)) {
      if (value !== undefined) headers.set(key, String(value));
    }
  }
  return {
    ...rest,
    credentials: "include",
    headers,
  };
}

function normalizeLimit(limit: number, fallback: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return fallback;
  }
  const normalized = Math.floor(limit);
  return normalized > 0 ? normalized : fallback;
}

function toQueryString(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function throwIfNotOk(response: Response): Promise<never> {
  const raw = await response.text().catch(() => "");
  let payload: ApiErrorPayload | null = null;
  let errorMessage = "";
  try {
    payload = JSON.parse(raw) as ApiErrorPayload;
    errorMessage =
      (typeof payload?.error === "string" && payload.error) ||
      (typeof payload?.message === "string" && payload.message) ||
      "";
  } catch {
    errorMessage = raw;
  }
  throw new ApiClientError(response.status, errorMessage || DEFAULT_ERROR_MESSAGE, payload);
}

async function safeFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    // Normalize browser network failures to a stable app-level error message.
    throw new ApiClientError(0, NETWORK_ERROR_MESSAGE, null, error);
  }
}

async function getJson<T>(path: string): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await safeFetch(`${API_URL}${path}`, buildApiRequestInit());

  if (!response.ok) {
    await throwIfNotOk(response);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await safeFetch(
    `${API_URL}${path}`,
    buildApiRequestInit({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

  if (!response.ok) {
    await throwIfNotOk(response);
  }

  return response.json() as Promise<T>;
}

export class ApiClientError extends Error {
  status: number;
  payload: ApiErrorPayload | null;
  cause?: unknown;

  constructor(status: number, message: string, payload: ApiErrorPayload | null = null, cause?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
    this.cause = cause;
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

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

function isNetworkApiError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 0;
}

function toIsoString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function parseTxnStatus(s: string): TransactionSummary["status"] {
  if (s === "executed" || s === "rejected" || s === "escalated") return s;
  return "executed";
}

function parseVerdictKind(s: string): VerdictSummary["verdict"] {
  if (s === "allow" || s === "flag" || s === "pause") return s;
  return "flag";
}

function parseOffsetCursor(before: string | undefined): number {
  if (before == null || before === "") return 0;
  const n = Number.parseInt(before, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

interface ApiPolicyRow {
  pubkey: string;
  owner: string;
  agent: string;
  allowedPrograms: string[];
  maxTxLamports: string;
  dailyBudgetLamports: string;
  dailySpentLamports?: string;
  sessionExpiry: string;
  isActive: boolean;
  squadsMultisig: string | null;
  escalationThreshold: string | null;
  anomalyScore: number;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiVerdictRow {
  id: string;
  txnId: string;
  policyPubkey: string;
  verdict: string;
  confidence: number;
  reasoning: string;
  model: string;
  latencyMs: number | null;
  prefilterSkipped: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: string;
}

interface ApiGuardedTxnRow {
  id: string;
  policyPubkey: string;
  txnSig: string;
  slot: string;
  blockTime: string;
  targetProgram: string;
  amountLamports: string | null;
  status: string;
  rejectReason: string | null;
  rawEvent: unknown;
  createdAt: string;
  verdict: ApiVerdictRow | null;
}

interface ApiIncidentRow {
  id: string;
  policyPubkey: string;
  pausedAt: string;
  pausedBy: string;
  reason: string;
  triggeringTxnSig: string | null;
  judgeVerdictId: string | null;
  fullReport: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  judgeVerdict: ApiVerdictRow | null;
}

function mapApiVerdictRow(row: ApiVerdictRow): VerdictSummary {
  return {
    id: row.id,
    txnId: row.txnId,
    policyPubkey: row.policyPubkey,
    verdict: parseVerdictKind(row.verdict),
    confidence: row.confidence,
    reasoning: row.reasoning,
    model: row.model,
    latencyMs: row.latencyMs,
    prefilterSkipped: row.prefilterSkipped,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    createdAt: toIsoString(row.createdAt),
    signals: [],
  };
}

function mapApiPolicyRow(row: ApiPolicyRow): PolicySummary {
  return {
    ...row,
    sessionExpiry: toIsoString(row.sessionExpiry),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapApiTxnRow(row: ApiGuardedTxnRow): TransactionSummary {
  const raw =
    row.rawEvent && typeof row.rawEvent === "object" && !Array.isArray(row.rawEvent)
      ? (row.rawEvent as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    policyPubkey: row.policyPubkey,
    txnSig: row.txnSig,
    slot: String(row.slot),
    blockTime: toIsoString(row.blockTime),
    targetProgram: row.targetProgram,
    amountLamports: row.amountLamports,
    status: parseTxnStatus(row.status),
    rejectReason: row.rejectReason,
    rawEvent: raw,
    createdAt: toIsoString(row.createdAt),
    verdict: row.verdict ? mapApiVerdictRow(row.verdict) : null,
  };
}

function mapApiIncidentRow(row: ApiIncidentRow): IncidentSummary {
  return {
    id: row.id,
    policyPubkey: row.policyPubkey,
    pausedAt: toIsoString(row.pausedAt),
    pausedBy: row.pausedBy,
    reason: row.reason,
    triggeringTxnSig: row.triggeringTxnSig,
    judgeVerdictId: row.judgeVerdictId,
    fullReport: row.fullReport,
    resolvedAt: row.resolvedAt == null ? null : toIsoString(row.resolvedAt),
    resolution: row.resolution,
    createdAt: toIsoString(row.createdAt),
  };
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

export async function requestSiwsNonce(pubkey: string): Promise<{ nonce: string; message: string }> {
  if (!USE_MOCK_API) {
    return postJson<{ nonce: string; message: string }>("/api/auth/siws/nonce", { pubkey });
  }

  const nonce = "mock-dashboard-nonce";
  return {
    nonce,
    message: [
      "Agent Guardrails Dashboard",
      "",
      `Wallet: ${pubkey}`,
      `Nonce: ${nonce}`,
      "Sign this message to verify wallet ownership.",
    ].join("\n"),
  };
}

export async function verifySiwsSignature(payload: {
  pubkey: string;
  message: string;
  signature: string;
}): Promise<{ ok: true }> {
  if (!payload.signature) {
    throw new Error("Missing signature");
  }
  if (!USE_MOCK_API) {
    return postJson<{ ok: true }>("/api/auth/siws/verify", {
      pubkey: payload.pubkey,
      signature: payload.signature,
      message: payload.message,
    });
  }
  return { ok: true };
}

export async function fetchPolicies(): Promise<PolicySummary[]> {
  if (!USE_MOCK_API) {
    try {
      const { policies } = await getJson<{ policies: ApiPolicyRow[] }>("/api/policies");
      return sortPolicies(policies.map(mapApiPolicyRow));
    } catch (error) {
      if (!isNetworkApiError(error)) throw error;
    }
  }
  return sortPolicies(POLICIES);
}

export async function fetchPolicy(pubkey: string): Promise<PolicySummary> {
  if (!USE_MOCK_API) {
    const policies = await fetchPolicies();
    const policy = policies.find((item) => item.pubkey === pubkey);
    if (!policy) {
      throw new Error("Policy not found");
    }
    return policy;
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
    try {
      const offset = parseOffsetCursor(before);
      const params = new URLSearchParams();
      if (policyPubkey) params.set("policy", policyPubkey);
      params.set("limit", String(safeLimit));
      params.set("offset", String(offset));
      const { transactions, total } = await getJson<{
        transactions: ApiGuardedTxnRow[];
        total: number;
      }>(`/api/transactions${toQueryString(params)}`);
      const items = transactions.map(mapApiTxnRow);
      const nextCursor = offset + items.length < total ? String(offset + items.length) : null;
      return { items, nextCursor };
    } catch (error) {
      if (!isNetworkApiError(error)) throw error;
    }
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
    try {
      const offset = parseOffsetCursor(before);
      const params = new URLSearchParams();
      if (policyPubkey) params.set("policy", policyPubkey);
      params.set("limit", String(safeLimit));
      params.set("offset", String(offset));
      const { incidents, total } = await getJson<{
        incidents: ApiIncidentRow[];
        total: number;
      }>(`/api/incidents${toQueryString(params)}`);
      const items = incidents.map(mapApiIncidentRow);
      const nextCursor = offset + items.length < total ? String(offset + items.length) : null;
      return { items, nextCursor };
    } catch (error) {
      if (!isNetworkApiError(error)) throw error;
    }
  }

  const filtered = sortIncidents(INCIDENTS).filter((incident) =>
    policyPubkey ? incident.policyPubkey === policyPubkey : true,
  );
  return paginate(filtered, before, safeLimit);
}

export async function fetchIncident(id: string): Promise<IncidentDetail> {
  if (!USE_MOCK_API) {
    try {
      const row = await getJson<ApiIncidentRow>(`/api/incidents/${id}`);
      const policy = await fetchPolicy(row.policyPubkey);
      return normalizeIncidentDetail({
        ...mapApiIncidentRow(row),
        policy: {
          pubkey: policy.pubkey,
          label: policy.label,
          isActive: policy.isActive,
        },
        judgeVerdict: row.judgeVerdict ? mapApiVerdictRow(row.judgeVerdict) : null,
      });
    } catch (error) {
      if (!isNetworkApiError(error)) throw error;
    }
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
