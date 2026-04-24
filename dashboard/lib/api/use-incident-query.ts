"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchIncident } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useIncidentQuery(incidentId: string) {
  return useQuery({
    queryKey: queryKeys.incident(incidentId),
    queryFn: () => fetchIncident(incidentId),
    enabled: Boolean(incidentId),
  });
}
