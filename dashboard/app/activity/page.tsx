"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell, TransactionRow } from "@/components/dashboard-ui";
import { fetchPolicies, fetchTransactions } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useActivityStore } from "@/lib/stores/activity";
import type { PaginatedResponse, PolicySummary, TransactionSummary } from "@/lib/types/dashboard";
import { effectiveVerdict } from "@/lib/utils";

export default function ActivityPage() {
  const { data: policies = [] } = useQuery<PolicySummary[]>({ queryKey: queryKeys.policies(), queryFn: fetchPolicies });
  const { data: transactions } = useQuery<PaginatedResponse<TransactionSummary>>({
    queryKey: queryKeys.transactions(),
    queryFn: () => fetchTransactions(),
  });
  const { selectedPolicyPubkey, verdictFilter, setSelectedPolicy, setVerdictFilter } = useActivityStore();

  const filtered = (transactions?.items ?? []).filter((txn: TransactionSummary) => {
    if (selectedPolicyPubkey && txn.policyPubkey !== selectedPolicyPubkey) return false;
    if (verdictFilter !== "all" && effectiveVerdict(txn.verdict?.verdict) !== verdictFilter) return false;
    return true;
  });

  return (
    <AppShell title="Activity" subtitle="Realtime feed of guarded transactions across all policies.">
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="toolbar">
          <select className="input select-inline" value={selectedPolicyPubkey ?? ""} onChange={(event) => setSelectedPolicy(event.target.value || null)}>
            <option value="">All agents</option>
            {policies.map((policy: PolicySummary) => (
              <option key={policy.pubkey} value={policy.pubkey}>{policy.label ?? policy.pubkey}</option>
            ))}
          </select>
          <select className="input select-inline" value={verdictFilter} onChange={(event) => setVerdictFilter(event.target.value as typeof verdictFilter)}>
            <option value="all">All verdicts</option>
            <option value="allow">Allow</option>
            <option value="flag">Flag</option>
            <option value="pause">Pause</option>
          </select>
        </div>
      </div>
      <div className="list">
        {filtered.length ? (
          filtered.map((txn: TransactionSummary) => (
            <TransactionRow key={txn.id} transaction={txn} showAgent />
          ))
        ) : (
          <div className="card empty">No transactions match the current filters.</div>
        )}
      </div>
    </AppShell>
  );
}
