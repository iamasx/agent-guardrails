"use client";

import { AppShell, TransactionRow } from "@/components/dashboard-ui";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/query-states";
import { getErrorMessage } from "@/lib/api/client";
import { useInfiniteTransactionsQuery } from "@/lib/api/use-infinite-transactions-query";
import { usePoliciesQuery } from "@/lib/api/use-policies-query";
import { useActivityFiltersStore } from "@/lib/stores/activity-filters";
import { shortAddress } from "@/lib/utils";

export function ActivityView() {
  const { selectedPolicyPubkey, verdictFilter, setSelectedPolicy, setVerdictFilter } = useActivityFiltersStore();
  const policiesQuery = usePoliciesQuery();
  const transactionsQuery = useInfiniteTransactionsQuery(selectedPolicyPubkey ?? undefined, 50);

  if (transactionsQuery.isLoading) {
    return (
      <AppShell title="Activity" subtitle="Global guarded transactions and AI verdicts.">
        <QueryLoading message="Loading activity feed…" listSkeleton />
      </AppShell>
    );
  }

  if (transactionsQuery.isError) {
    return (
      <AppShell title="Activity" subtitle="Global guarded transactions and AI verdicts.">
        <QueryError error={transactionsQuery.error} onRetry={() => void transactionsQuery.refetch()} />
      </AppShell>
    );
  }

  const transactions = (transactionsQuery.data?.items ?? []).filter((item) =>
    verdictFilter === "all" ? true : item.verdict?.verdict === verdictFilter,
  );

  const policiesError =
    policiesQuery.isError && !policiesQuery.data?.length ? getErrorMessage(policiesQuery.error) : null;

  return (
    <AppShell title="Activity" subtitle="Global guarded transactions and AI verdicts.">
      {policiesError ? (
        <div className="mb-4">
          <QueryError
            error={policiesQuery.error}
            title="Could not load policy filter list"
            onRetry={() => void policiesQuery.refetch()}
          />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2.5">
        <select
          className="w-full rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 outline-none transition-all duration-200 focus:border-blue-700/60 focus:bg-zinc-950/80 focus:ring-1 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          value={selectedPolicyPubkey ?? ""}
          onChange={(event) => setSelectedPolicy(event.target.value || null)}
          aria-label="Filter by policy"
        >
          <option value="">All policies</option>
          {(policiesQuery.data ?? []).map((policy) => (
            <option key={policy.pubkey} value={policy.pubkey}>
              {policy.label ?? shortAddress(policy.pubkey)}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 outline-none transition-all duration-200 focus:border-blue-700/60 focus:bg-zinc-950/80 focus:ring-1 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
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

      <p className="mb-3 text-xs text-zinc-500">
        {transactionsQuery.data?.items.length ?? 0} loaded (newest first)
        {transactionsQuery.data?.isCapped ? "; feed capped" : ""}. Filters narrow the list below.
      </p>

      {transactions.length ? (
        <div className="grid gap-3">
          {transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} showAgent />
          ))}
        </div>
      ) : (
        <QueryEmpty
          title="No transactions match the current filters."
          description="Try another policy or verdict, or load older activity below."
        />
      )}

      {transactionsQuery.hasNextPage ? (
        <div className="mt-6 flex justify-center">
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
    </AppShell>
  );
}
