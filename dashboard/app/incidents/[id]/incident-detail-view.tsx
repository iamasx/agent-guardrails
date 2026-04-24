"use client";

import { AppShell, IncidentTimeline, Metric, StatusChip } from "@/components/dashboard-ui";
import { ReportMarkdown } from "@/components/report-markdown";
import { QueryError, QueryLoading } from "@/components/query-states";
import { useIncidentQuery } from "@/lib/api/use-incident-query";
import { shortAddress } from "@/lib/utils";

export function IncidentDetailView({ id }: { id: string }) {
  const incidentQuery = useIncidentQuery(id);

  if (incidentQuery.isLoading) {
    return (
      <AppShell title="Incident Detail" subtitle="Timeline and model reasoning for a specific pause.">
        <QueryLoading message="Loading incident details…" />
      </AppShell>
    );
  }

  if (incidentQuery.isError || !incidentQuery.data) {
    return (
      <AppShell title="Incident Detail" subtitle="Timeline and model reasoning for a specific pause.">
        <QueryError
          error={incidentQuery.error ?? new Error("Unknown error")}
          title="Unable to load incident"
          onRetry={() => void incidentQuery.refetch()}
        />
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Policy" value={incident.policy.label ?? shortAddress(incident.policy.pubkey)} />
        <Metric label="Paused by" value={incident.pausedBy} />
        <Metric
          label="Status"
          value={<StatusChip tone={incident.resolvedAt ? "green" : "red"}>{incident.resolvedAt ? "Resolved" : "Active"}</StatusChip>}
        />
      </div>

      <div className="mt-4">
        <IncidentTimeline items={timelineItems} />
      </div>

      {incident.fullReport ? (
        <div className="mt-4 rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 shadow-lg shadow-blue-950/20 backdrop-blur-sm transition-all duration-300">
          <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Incident report</div>
          <ReportMarkdown markdown={incident.fullReport} />
        </div>
      ) : null}
    </AppShell>
  );
}
