import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { GuardedTxn } from "@/lib/mock/transactions";
import type {
  IncidentDetail,
  IncidentSummary,
  PaginatedResponse,
  PolicySummary,
  TransactionSummary,
  VerdictSummary,
} from "@/lib/types/dashboard";

export const MAX_FEED_ITEMS = 200;

export function updateIfExists<T>(queryClient: QueryClient, key: QueryKey, updater: (old: T) => T): void {
  const existing = queryClient.getQueryData<T>(key);
  if (existing !== undefined) {
    queryClient.setQueryData<T>(key, updater(existing));
  }
}

function capItems<T>(items: T[], max: number): T[] {
  return items.length <= max ? items : items.slice(0, max);
}

function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toISOString" in value && typeof (value as Date).toISOString === "function") {
    return (value as Date).toISOString();
  }
  return new Date(String(value)).toISOString();
}

function asTxnStatus(s: string): GuardedTxn["status"] {
  if (s === "executed" || s === "rejected" || s === "escalated") return s;
  return "executed";
}

function asVerdictKind(s: string): VerdictSummary["verdict"] {
  if (s === "allow" || s === "flag" || s === "pause") return s;
  return "flag";
}

function asRawEvent(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Maps SSE / SSENewTransaction JSON into dashboard TransactionSummary. */
export function sseNewTxnToSummary(raw: unknown): TransactionSummary {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    policyPubkey: String(o.policyPubkey ?? ""),
    txnSig: String(o.txnSig ?? ""),
    slot: String(o.slot ?? ""),
    blockTime: toIso(o.blockTime),
    targetProgram: String(o.targetProgram ?? ""),
    amountLamports: o.amountLamports == null ? null : String(o.amountLamports),
    status: asTxnStatus(String(o.status ?? "executed")),
    rejectReason: o.rejectReason == null ? null : String(o.rejectReason),
    rawEvent: asRawEvent(o.rawEvent),
    createdAt: toIso(o.createdAt),
    verdict: null,
  };
}

/** Maps SSE / SSEVerdict JSON into VerdictSummary. */
export function sseVerdictToSummary(raw: unknown): VerdictSummary {
  const o = raw as Record<string, unknown>;
  const signals = Array.isArray(o.signals) ? o.signals.map((s) => String(s)) : [];
  return {
    id: String(o.id ?? ""),
    txnId: String(o.txnId ?? ""),
    policyPubkey: String(o.policyPubkey ?? ""),
    verdict: asVerdictKind(String(o.verdict ?? "flag")),
    confidence: typeof o.confidence === "number" ? o.confidence : Number(o.confidence ?? 0),
    reasoning: String(o.reasoning ?? ""),
    model: String(o.model ?? ""),
    latencyMs: o.latencyMs == null ? null : Number(o.latencyMs),
    prefilterSkipped: Boolean(o.prefilterSkipped),
    promptTokens: o.promptTokens == null ? null : Number(o.promptTokens),
    completionTokens: o.completionTokens == null ? null : Number(o.completionTokens),
    createdAt: toIso(o.createdAt),
    signals,
  };
}

/** Maps SSE / SSEAgentPaused JSON into IncidentSummary. */
export function sseAgentPausedToIncidentSummary(raw: unknown): IncidentSummary {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    policyPubkey: String(o.policyPubkey ?? ""),
    pausedAt: toIso(o.pausedAt),
    pausedBy: String(o.pausedBy ?? ""),
    reason: String(o.reason ?? ""),
    triggeringTxnSig: o.triggeringTxnSig == null ? null : String(o.triggeringTxnSig),
    judgeVerdictId: o.judgeVerdictId == null ? null : String(o.judgeVerdictId),
    fullReport: o.fullReport == null ? null : String(o.fullReport),
    resolvedAt: o.resolvedAt == null ? null : toIso(o.resolvedAt),
    resolution: o.resolution == null ? null : String(o.resolution),
    createdAt: toIso(o.createdAt),
  };
}

function prependTxn(
  old: PaginatedResponse<TransactionSummary>,
  txn: TransactionSummary,
): PaginatedResponse<TransactionSummary> {
  const deduped = old.items.filter((t) => t.id !== txn.id);
  const items = capItems([txn, ...deduped], MAX_FEED_ITEMS);
  return { ...old, items };
}

function patchTxnVerdict(
  old: PaginatedResponse<TransactionSummary>,
  txnId: string,
  verdict: VerdictSummary,
): PaginatedResponse<TransactionSummary> {
  return {
    ...old,
    items: old.items.map((txn) => (txn.id === txnId ? { ...txn, verdict } : txn)),
  };
}

function prependIncident(
  old: PaginatedResponse<IncidentSummary>,
  incident: IncidentSummary,
): PaginatedResponse<IncidentSummary> {
  const deduped = old.items.filter((i) => i.id !== incident.id);
  const items = capItems([incident, ...deduped], MAX_FEED_ITEMS);
  return { ...old, items };
}

export function applyNewTransactionEvent(queryClient: QueryClient, raw: unknown): void {
  const summary = sseNewTxnToSummary(raw);
  updateIfExists<PaginatedResponse<TransactionSummary>>(queryClient, queryKeys.transactions(), (old) =>
    prependTxn(old, summary),
  );
  updateIfExists<PaginatedResponse<TransactionSummary>>(
    queryClient,
    queryKeys.transactionsByPolicy(summary.policyPubkey),
    (old) => prependTxn(old, summary),
  );
}

export function applyVerdictEvent(queryClient: QueryClient, raw: unknown): void {
  const verdict = sseVerdictToSummary(raw);
  const patch = (old: PaginatedResponse<TransactionSummary>) =>
    patchTxnVerdict(old, verdict.txnId, verdict);
  updateIfExists<PaginatedResponse<TransactionSummary>>(queryClient, queryKeys.transactions(), patch);
  updateIfExists<PaginatedResponse<TransactionSummary>>(
    queryClient,
    queryKeys.transactionsByPolicy(verdict.policyPubkey),
    patch,
  );
}

export function applyAgentPausedEvent(queryClient: QueryClient, raw: unknown): void {
  const incident = sseAgentPausedToIncidentSummary(raw);
  const policyPubkey = incident.policyPubkey;

  updateIfExists<PaginatedResponse<IncidentSummary>>(queryClient, queryKeys.incidents(), (old) =>
    prependIncident(old, incident),
  );
  updateIfExists<PaginatedResponse<IncidentSummary>>(
    queryClient,
    queryKeys.incidentsByPolicy(policyPubkey),
    (old) => prependIncident(old, incident),
  );

  updateIfExists<PolicySummary[]>(queryClient, queryKeys.policies(), (old) =>
    old.map((p) => (p.pubkey === policyPubkey ? { ...p, isActive: false } : p)),
  );

  updateIfExists<PolicySummary>(queryClient, queryKeys.policy(policyPubkey), (old) =>
    old.pubkey === policyPubkey ? { ...old, isActive: false } : old,
  );

  updateIfExists<IncidentDetail>(queryClient, queryKeys.incident(incident.id), (old) => ({
    ...old,
    ...incident,
    policy: old.policy,
    judgeVerdict: old.judgeVerdict,
  }));
}

export function applyReportReadyEvent(queryClient: QueryClient, raw: unknown): void {
  const o = raw as Record<string, unknown>;
  const incidentId = String(o.incidentId ?? "");
  const fullReport = String(o.fullReport ?? "");
  const policyPubkey = o.policyPubkey == null ? "" : String(o.policyPubkey);

  const patchList = (old: PaginatedResponse<IncidentSummary>): PaginatedResponse<IncidentSummary> => ({
    ...old,
    items: old.items.map((inc) => (inc.id === incidentId ? { ...inc, fullReport } : inc)),
  });

  updateIfExists<PaginatedResponse<IncidentSummary>>(queryClient, queryKeys.incidents(), patchList);
  if (policyPubkey) {
    updateIfExists<PaginatedResponse<IncidentSummary>>(
      queryClient,
      queryKeys.incidentsByPolicy(policyPubkey),
      patchList,
    );
  }

  updateIfExists<IncidentDetail>(queryClient, queryKeys.incident(incidentId), (old) => ({
    ...old,
    fullReport,
  }));
}
