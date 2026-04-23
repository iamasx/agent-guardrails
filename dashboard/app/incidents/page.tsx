"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell, IncidentTable } from "@/components/dashboard-ui";
import { fetchIncidents } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export default function IncidentsPage() {
  const { data: incidents } = useQuery({
    queryKey: queryKeys.incidents(),
    queryFn: () => fetchIncidents(),
  });

  return (
    <AppShell title="Incidents" subtitle="All pause events and their postmortem context.">
      <IncidentTable incidents={incidents?.items ?? []} />
    </AppShell>
  );
}
