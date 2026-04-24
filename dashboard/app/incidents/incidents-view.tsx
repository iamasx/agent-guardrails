"use client";

import { AppShell, IncidentTable } from "@/components/dashboard-ui";
import { getErrorMessage } from "@/lib/api/client";
import { useIncidentsQuery } from "@/lib/api/use-incidents-query";

export function IncidentsView() {
  const incidentsQuery = useIncidentsQuery(undefined, 50);

  if (incidentsQuery.isLoading) {
    return (
      <AppShell title="Incidents" subtitle="Historical pauses and generated postmortems.">
        <div className="empty">Loading incidents...</div>
      </AppShell>
    );
  }

  if (incidentsQuery.isError) {
    return (
      <AppShell title="Incidents" subtitle="Historical pauses and generated postmortems.">
        <div className="empty">Unable to load incidents: {getErrorMessage(incidentsQuery.error)}</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Incidents" subtitle="Historical pauses and generated postmortems.">
      <IncidentTable incidents={incidentsQuery.data?.items ?? []} />
    </AppShell>
  );
}
