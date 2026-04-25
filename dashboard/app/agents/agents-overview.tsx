"use client";

import Link from "next/link";
import { PolicyCard } from "@/components/dashboard-ui";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/query-states";
import { getErrorMessage } from "@/lib/api/client";
import { usePoliciesQuery } from "@/lib/api/use-policies-query";

export function AgentsOverview() {
  const { data, isLoading, isError, error, refetch } = usePoliciesQuery();

  if (isLoading) {
    return <QueryLoading message="Loading policies…" listSkeleton />;
  }

  if (isError) {
    return (
      <QueryError
        error={error}
        title="Unable to load policies"
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data?.length) {
    return (
      <QueryEmpty
        title="No policies found yet."
        description="Create a policy on-chain to see it listed here."
        action={
          <Link
            href="/agents/new"
            className="button button-primary"
          >
            New policy
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
      {data.map((policy) => (
        <PolicyCard key={policy.pubkey} policy={policy} />
      ))}
    </div>
  );
}
