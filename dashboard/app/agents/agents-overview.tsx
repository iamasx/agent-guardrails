"use client";

import { usePoliciesQuery } from "@/lib/api/use-policies-query";
import { getErrorMessage } from "@/lib/api/client";
import { PolicyCard } from "@/components/dashboard-ui";

export function AgentsOverview() {
  const { data, isLoading, isError, error } = usePoliciesQuery();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
        Loading policies...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-900/60 bg-zinc-950 p-4 text-sm text-rose-300">
        Unable to load policies: {getErrorMessage(error)}
      </div>
    );
  }

  if (!data?.length) {
    return <div className="empty">No policies found yet.</div>;
  }

  return <div className="grid three">{data.map((policy) => <PolicyCard key={policy.pubkey} policy={policy} />)}</div>;
}
