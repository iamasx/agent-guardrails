import type { Incident } from "@/lib/mock/incidents";
import type { Policy } from "@/lib/mock/policies";
import type { GuardedTxn } from "@/lib/mock/transactions";
import type { AnomalyVerdict } from "@/lib/mock/verdicts";

export type PolicySummary = Policy;

export interface VerdictSummary extends AnomalyVerdict {
  signals: string[];
}

export interface TransactionSummary extends GuardedTxn {
  verdict: VerdictSummary | null;
}

export type IncidentSummary = Incident;

export interface IncidentDetail extends Incident {
  policy: {
    pubkey: string;
    label: string | null;
    isActive: boolean;
  };
  judgeVerdict: VerdictSummary | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  details?: string;
}

export type ApiListResponse<T> = PaginatedResponse<T> | T[];
