import { PROGRAM_LABELS } from "@/lib/mock/policies";
import type { PolicySummary } from "@/lib/types/dashboard";

export function shortAddress(value: string, start = 4, end = 4): string {
  if (!value) return "";
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function lamportsToSol(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1_000_000_000;
}

export function programLabel(program: string): string {
  return PROGRAM_LABELS[program] ?? shortAddress(program, 6, 4);
}

export function policyLabel(pubkey: string): string {
  return shortAddress(pubkey, 6, 4);
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function formatRelativeTime(value: string): string {
  const diffMs = new Date(value).getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const absDays = Math.round(absMs / 86_400_000);
  if (absDays >= 1) return diffMs >= 0 ? `in ${absDays}d` : `${absDays}d ago`;
  const absHours = Math.round(absMs / 3_600_000);
  if (absHours >= 1) return diffMs >= 0 ? `in ${absHours}h` : `${absHours}h ago`;
  const absMins = Math.max(0, Math.round(absMs / 60_000));
  return diffMs >= 0 ? `in ${absMins}m` : `${absMins}m ago`;
}

export function statusTone(policy: PolicySummary): "green" | "amber" | "red" {
  if (!policy.isActive) return "red";
  if (new Date(policy.sessionExpiry).getTime() < Date.now()) return "amber";
  return "green";
}

export function verdictTone(verdict?: string | null): "green" | "amber" | "red" | "slate" {
  if (verdict === "pause") return "red";
  if (verdict === "flag") return "amber";
  if (verdict === "allow") return "green";
  return "slate";
}

export function effectiveVerdict(verdict?: string | null): "allow" | "flag" | "pause" {
  if (verdict === "flag" || verdict === "pause") return verdict;
  return "allow";
}
