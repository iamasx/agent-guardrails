"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchIncidents } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useIncidentsQuery(policyPubkey?: string, limit = 25) {
  return useQuery({
    queryKey: policyPubkey ? queryKeys.incidentsByPolicy(policyPubkey) : queryKeys.incidents(),
    queryFn: () => fetchIncidents(policyPubkey, undefined, limit),
  });
}
