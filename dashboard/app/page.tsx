"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Metric, PolicyCard } from "@/components/dashboard-ui";
import { fetchIncidents, fetchPolicies, fetchTransactions } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export default function Home() {
  const { data: policies = [] } = useQuery({
    queryKey: queryKeys.policies(),
    queryFn: fetchPolicies,
  });
  const { data: transactions } = useQuery({
    queryKey: queryKeys.transactions(),
    queryFn: () => fetchTransactions(),
  });
  const { data: incidents } = useQuery({
    queryKey: queryKeys.incidents(),
    queryFn: () => fetchIncidents(),
  });

  return (
    <AppShell
      title="Guardrails overview"
      subtitle="Monitor autonomous agents, spend budgets, and incident responses from one place."
      actions={<Link className="button button-primary" href="/agents/new">Create policy</Link>}
    >
      <section className="grid two">
        <div className="card">
          <div className="card-title">Snapshot</div>
          <div className="grid two">
            <Metric label="Policies" value={policies.length} />
            <Metric label="Transactions" value={transactions?.items.length ?? 0} />
            <Metric label="Incidents" value={incidents?.items.length ?? 0} />
            <Metric label="Paused agents" value={policies.filter((policy) => !policy.isActive).length} />
          </div>
        </div>
        <div className="card">
          <div className="spread" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ fontSize: "1.2rem" }}>Recent agents</div>
            <Link className="button button-secondary" href="/agents">View all</Link>
          </div>
          <div className="list">
            {policies.slice(0, 3).map((policy) => (
              <PolicyCard key={policy.pubkey} policy={policy} />
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
