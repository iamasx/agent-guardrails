"use client";

import { AppShell, IncidentTable, Metric, SpendGauge, TransactionRow } from "@/components/dashboard-ui";
import { getErrorMessage } from "@/lib/api/client";
import { useIncidentsQuery } from "@/lib/api/use-incidents-query";
import { usePolicyQuery } from "@/lib/api/use-policy-query";
import { useTransactionsQuery } from "@/lib/api/use-transactions-query";

export function AgentDetailView({ pubkey }: { pubkey: string }) {
  const policyQuery = usePolicyQuery(pubkey);
  const transactionsQuery = useTransactionsQuery(pubkey, 10);
  const incidentsQuery = useIncidentsQuery(pubkey, 10);

  if (policyQuery.isLoading) {
    return (
      <AppShell title="Agent Detail" subtitle="Live status, spend view, and recent guarded activity.">
        <div className="empty">Loading agent details...</div>
      </AppShell>
    );
  }

  if (policyQuery.isError || !policyQuery.data) {
    return (
      <AppShell title="Agent Detail" subtitle="Live status, spend view, and recent guarded activity.">
        <div className="empty">Unable to load agent: {getErrorMessage(policyQuery.error)}</div>
      </AppShell>
    );
  }

  const policy = policyQuery.data;
  const transactions = transactionsQuery.data?.items ?? [];
  const incidents = incidentsQuery.data?.items ?? [];
  const shortenedPolicyPubkey =
    policy.pubkey.length > 8 ? `${policy.pubkey.slice(0, 4)}...${policy.pubkey.slice(-4)}` : policy.pubkey;

  return (
    <AppShell
      title={policy.label ?? "Agent Detail"}
      subtitle="Live status, spend view, and recent guarded activity."
    >
      <div className="grid three">
        <Metric label="Policy" value={shortenedPolicyPubkey} />
        <Metric label="Status" value={policy.isActive ? "Active" : "Paused"} />
        <Metric label="Session expiry" value={new Date(policy.sessionExpiry).toLocaleString()} />
      </div>

      <div className="card mt-4">
        <div className="card-title">Daily spend</div>
        <SpendGauge
          spentLamports={String(policy.dailySpentLamports ?? "0")}
          budgetLamports={String(policy.dailyBudgetLamports)}
        />
      </div>

      <div className="card mt-4">
        <div className="card-title">Recent transactions</div>
        {transactionsQuery.isLoading ? (
          <div className="empty">Loading transactions...</div>
        ) : transactionsQuery.isError ? (
          <div className="empty">Unable to load transactions: {getErrorMessage(transactionsQuery.error)}</div>
        ) : transactions.length ? (
          <div className="grid gap-3">
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        ) : (
          <div className="empty">No transactions yet.</div>
        )}
      </div>

      <div className="mt-4">
        <div className="card-title">Related incidents</div>
        {incidentsQuery.isLoading ? (
          <div className="empty">Loading incidents...</div>
        ) : incidentsQuery.isError ? (
          <div className="empty">Unable to load incidents: {getErrorMessage(incidentsQuery.error)}</div>
        ) : (
          <IncidentTable incidents={incidents} />
        )}
      </div>
    </AppShell>
  );
}
