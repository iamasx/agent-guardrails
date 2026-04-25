"use client";

import { AppShell, IncidentTable, Metric, SpendGauge, TransactionRow } from "@/components/dashboard-ui";
import { KillSwitchButton } from "@/components/kill-switch-button";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/query-states";
import { getErrorMessage } from "@/lib/api/client";
import { useInfiniteTransactionsQuery } from "@/lib/api/use-infinite-transactions-query";
import { useIncidentsQuery } from "@/lib/api/use-incidents-query";
import { usePolicyQuery } from "@/lib/api/use-policy-query";

export function AgentDetailView({ pubkey }: { pubkey: string }) {
  const policyQuery = usePolicyQuery(pubkey);
  const transactionsQuery = useInfiniteTransactionsQuery(pubkey, 10);
  const incidentsQuery = useIncidentsQuery(pubkey, 10);

  if (policyQuery.isLoading) {
    return (
      <AppShell title="Agent Detail" subtitle="Live status, spend view, and recent guarded activity.">
        <QueryLoading message="Loading agent details…" />
      </AppShell>
    );
  }

  if (policyQuery.isError || !policyQuery.data) {
    return (
      <AppShell title="Agent Detail" subtitle="Live status, spend view, and recent guarded activity.">
        <QueryError
          error={policyQuery.error ?? new Error("Unknown error")}
          title="Unable to load agent"
          onRetry={() => void policyQuery.refetch()}
        />
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Policy" value={shortenedPolicyPubkey} />
        <Metric label="Status" value={policy.isActive ? "Active" : "Paused"} />
        <Metric label="Session expiry" value={new Date(policy.sessionExpiry).toLocaleString()} />
      </div>

      <KillSwitchButton policy={policy} />

      <div className="panel-glow mt-4 p-6">
        <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Daily spend</div>
        <SpendGauge
          spentLamports={String(policy.dailySpentLamports ?? "0")}
          budgetLamports={String(policy.dailyBudgetLamports)}
        />
      </div>

      <div className="panel-glow mt-4 p-6">
        <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Recent transactions</div>
        {transactionsQuery.isLoading ? (
          <QueryLoading message="Loading transactions…" />
        ) : transactionsQuery.isError ? (
          <QueryError
            error={transactionsQuery.error}
            onRetry={() => void transactionsQuery.refetch()}
          />
        ) : transactions.length ? (
          <>
            {transactionsQuery.data?.isCapped ? (
              <p className="mb-3 text-xs text-zinc-500">
                Showing {transactions.length} transactions (newest first, feed capped).
              </p>
            ) : (
              <p className="mb-3 text-xs text-zinc-500">
                Showing {transactions.length} transaction{transactions.length === 1 ? "" : "s"} (newest first).
              </p>
            )}
            <div className="grid gap-3">
              {transactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </div>
            {transactionsQuery.hasNextPage ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  className="button button-secondary disabled:opacity-50"
                  disabled={transactionsQuery.isFetchingNextPage}
                  onClick={() => void transactionsQuery.fetchNextPage()}
                >
                  {transactionsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <QueryEmpty title="No transactions yet." description="Guarded activity for this policy will appear here." />
        )}
      </div>

      <div className="panel-glow mt-4 p-5">
        <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Related incidents</div>
        {incidentsQuery.isLoading ? (
          <QueryLoading message="Loading incidents…" />
        ) : incidentsQuery.isError ? (
          <QueryError error={incidentsQuery.error} onRetry={() => void incidentsQuery.refetch()} />
        ) : (
          <IncidentTable incidents={incidents} />
        )}
      </div>
    </AppShell>
  );
}
