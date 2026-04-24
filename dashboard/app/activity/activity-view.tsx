"use client";

import { AppShell, TransactionRow } from "@/components/dashboard-ui";
import { getErrorMessage } from "@/lib/api/client";
import { usePoliciesQuery } from "@/lib/api/use-policies-query";
import { useTransactionsQuery } from "@/lib/api/use-transactions-query";
import { useActivityFiltersStore } from "@/lib/stores/activity-filters";

export function ActivityView() {
  const { selectedPolicyPubkey, verdictFilter, setSelectedPolicy, setVerdictFilter } = useActivityFiltersStore();
  const policiesQuery = usePoliciesQuery();
  const transactionsQuery = useTransactionsQuery(selectedPolicyPubkey ?? undefined, 50);

  if (transactionsQuery.isLoading) {
    return (
      <AppShell title="Activity" subtitle="Global guarded transactions and AI verdicts.">
        <div className="empty">Loading activity feed...</div>
      </AppShell>
    );
  }

  if (transactionsQuery.isError) {
    return (
      <AppShell title="Activity" subtitle="Global guarded transactions and AI verdicts.">
        <div className="empty">Unable to load activity: {getErrorMessage(transactionsQuery.error)}</div>
      </AppShell>
    );
  }

  const transactions = (transactionsQuery.data?.items ?? []).filter((item) =>
    verdictFilter === "all" ? true : item.verdict?.verdict === verdictFilter,
  );

  return (
    <AppShell title="Activity" subtitle="Global guarded transactions and AI verdicts.">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <select
          className="input"
          value={selectedPolicyPubkey ?? ""}
          onChange={(event) => setSelectedPolicy(event.target.value || null)}
          aria-label="Filter by policy"
        >
          <option value="">All policies</option>
          {(policiesQuery.data ?? []).map((policy) => (
            <option key={policy.pubkey} value={policy.pubkey}>
              {policy.label ?? policy.pubkey}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={verdictFilter}
          onChange={(event) => setVerdictFilter(event.target.value as "all" | "allow" | "flag" | "pause")}
          aria-label="Filter by verdict"
        >
          <option value="all">All verdicts</option>
          <option value="allow">Allow</option>
          <option value="flag">Flag</option>
          <option value="pause">Pause</option>
        </select>
      </div>

      {transactions.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} showAgent />
          ))}
        </div>
      ) : (
        <div className="empty">No transactions match the current filters.</div>
      )}
    </AppShell>
  );
}
