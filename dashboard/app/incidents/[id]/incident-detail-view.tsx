"use client";

import Link from "next/link";
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
  const isResolved = Boolean(incident.resolvedAt);
  const pausedByType = incident.judgeVerdict ? "monitor" : "owner";
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
      <section className="mb-6 border-b border-[#1e2433] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[26px] font-semibold tracking-tight text-[#e6e9f2]">
                {incident.policy.label ?? shortAddress(incident.policy.pubkey)}
              </h2>
              {isResolved ? (
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                  RESOLVED
                </span>
              ) : (
                <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-300">
                  ACTIVE
                </span>
              )}
              <span className="rounded border border-[#1e2433] bg-[#10131c] px-2 py-0.5 font-mono text-[11px] text-[#8a93a8]">
                Incident #{incident.id.slice(-4)}
              </span>
            </div>
            <div className="mt-2 font-mono text-[12.5px] text-[#5b6479]">{incident.policy.pubkey}</div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#8a93a8]">
              <div>
                <span className="mr-2 text-[#5b6479]">Paused at</span>
                <span className="font-mono">{new Date(incident.pausedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="mr-2 text-[#5b6479]">Paused by</span>
                <span className="font-mono">
                  {pausedByType} · {shortAddress(incident.pausedBy, 4, 4)}
                </span>
              </div>
              {incident.resolvedAt ? (
                <div>
                  <span className="mr-2 text-[#5b6479]">Resolved</span>
                  <span className="font-mono">{new Date(incident.resolvedAt).toLocaleString()}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/agents/${incident.policy.pubkey}`} className="rounded-md border border-[#2a3142] bg-[#10131c] px-3 py-2 text-sm text-[#e6e9f2] hover:border-[#384056]">
              View agent
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Policy" value={incident.policy.label ?? shortAddress(incident.policy.pubkey)} />
        <Metric label="Paused by" value={incident.pausedBy} />
        <Metric label="Status" value={<StatusChip tone={isResolved ? "green" : "red"}>{isResolved ? "Resolved" : "Active"}</StatusChip>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <div className="rounded-xl border border-[#1e2433] bg-[#0b0d14] p-5">
          <div className="mb-3 text-[11px] uppercase tracking-[0.1em] text-[#5b6479]">Timeline</div>
          <IncidentTimeline items={timelineItems} />
        </div>

        <div className="rounded-xl border border-[#1e2433] bg-[#0b0d14] p-5">
          <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-[#5b6479]">
            <span>Opus postmortem</span>
            {incident.fullReport ? (
              <span className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[11px] text-violet-200 normal-case tracking-normal">
                claude-opus-4-7
              </span>
            ) : null}
          </div>
          {incident.fullReport ? (
            <ReportMarkdown markdown={incident.fullReport} />
          ) : (
            <div className="py-4 text-sm text-[#8a93a8]">
              No AI postmortem generated for this incident.
              {incident.resolution ? (
                <div className="mt-4 rounded-md border border-[#1e2433] bg-[#10131c] p-3">
                  <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-[#5b6479]">Resolution</div>
                  <div className="text-[#e6e9f2]">{incident.resolution}</div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
