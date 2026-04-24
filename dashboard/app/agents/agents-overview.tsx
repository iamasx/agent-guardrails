"use client";

import { usePoliciesQuery } from "@/lib/api/use-policies-query";
import { getErrorMessage } from "@/lib/api/client";

export function AgentsOverview() {
  const { data, isLoading, isError, error } = usePoliciesQuery();

  if (isLoading) {
    return <div className="empty">Loading policies...</div>;
  }

  if (isError) {
    return <div className="empty">Unable to load policies: {getErrorMessage(error)}</div>;
  }

  return (
    <div className="empty">
      Policy data path is wired. Found {data?.length ?? 0} policies.
    </div>
  );
}
