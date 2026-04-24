"use client";

import { AppShell, IncidentTimeline, Metric, SimpleMarkdown, StatusChip } from "@/components/dashboard-ui";
import { getErrorMessage } from "@/lib/api/client";
import { useIncidentQuery } from "@/lib/api/use-incident-query";

export function IncidentDetailView({ id }: { id: string }) {
  const incidentQuery = useIncidentQuery(id);

  if (incidentQuery.isLoading) {
    return (
      <AppShell title="Incident Detail" subtitle="Timeline and model reasoning for a specific pause.">
        <div className="empty">Loading incident details...</div>
      </AppShell>
    );
  }

  if (incidentQuery.isError || !incidentQuery.data) {
    return (
      <AppShell title="Incident Detail" subtitle="Timeline and model reasoning for a specific pause.">
        <div className="empty">Unable to load incident: {getErrorMessage(incidentQuery.error)}</div>
      </AppShell>
    );
  }

  const incident = incidentQuery.data;
  const timelineItems = [
    {
      time: new Date(incident.pausedAt).toLocaleTimeString(),
      title: "Agent paused",
      detail: incident.reason,
      tone: "red" as const,
    },
    incident.triggeringTxnSig
      ? {
          time: new Date(incident.pausedAt).toLocaleTimeString(),
          title: "Triggering transaction",
          detail: incident.triggeringTxnSig,
          tone: "amber" as const,
        }
      : null,
    incident.judgeVerdict
      ? {
          time: new Date(incident.judgeVerdict.createdAt).toLocaleTimeString(),
          title: `Verdict: ${incident.judgeVerdict.verdict.toUpperCase()}`,
          detail: incident.judgeVerdict.reasoning,
          tone: incident.judgeVerdict.verdict === "pause" ? ("red" as const) : ("amber" as const),
        }
      : null,
    incident.fullReport
      ? {
          time: new Date(incident.createdAt).toLocaleTimeString(),
          title: "Report available",
          detail: "Generated incident report attached below.",
          tone: "blue" as const,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <AppShell title="Incident Detail" subtitle="Timeline and model reasoning for a specific pause.">
      <div className="grid three">
        <Metric label="Policy" value={incident.policy.label ?? incident.policy.pubkey} />
        <Metric label="Paused by" value={incident.pausedBy} />
        <Metric
          label="Status"
          value={<StatusChip tone={incident.resolvedAt ? "green" : "red"}>{incident.resolvedAt ? "Resolved" : "Active"}</StatusChip>}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <IncidentTimeline items={timelineItems} />
      </div>

      {incident.fullReport ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Incident report</div>
          <SimpleMarkdown markdown={incident.fullReport} />
        </div>
      ) : null}
    </AppShell>
  );
}
