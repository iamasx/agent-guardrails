"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell, SpendGauge, StatusChip, TransactionRow } from "@/components/dashboard-ui";
import { fetchIncidents, fetchPolicy, fetchTransactions } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { shortAddress, statusTone } from "@/lib/utils";

export default function AgentDetailPage({ params }: { params: { pubkey: string } }) {
  const { data: policy } = useQuery({
    queryKey: queryKeys.policyByPubkey(params.pubkey),
    queryFn: () => fetchPolicy(params.pubkey),
  });
  const { data: transactions } = useQuery({
    queryKey: queryKeys.transactionsByPolicy(params.pubkey),
    queryFn: () => fetchTransactions(params.pubkey),
  });
  const { data: incidents } = useQuery({
    queryKey: queryKeys.incidentsByPolicy(params.pubkey),
    queryFn: () => fetchIncidents(params.pubkey),
  });

  if (!policy) {
    return <AppShell title="Agent detail"><div className="card empty">Policy not found.</div></AppShell>;
  }

  const spentLamports = String(
    (transactions?.items ?? []).reduce((sum, txn) => sum + Number(txn.amountLamports ?? 0), 0),
  );

  return (
    <AppShell
      title={policy.label ?? shortAddress(policy.pubkey, 8, 4)}
      subtitle="Live policy state, spend usage, and recent guarded execution history."
      actions={<Link className="button button-secondary" href={`/agents/${policy.pubkey}/policy`}>Edit policy</Link>}
    >
      <section className="grid two">
        <div className="card">
          <div className="spread">
            <div className="card-title">Status</div>
            <StatusChip tone={statusTone(policy)}>{policy.isActive ? "Active" : "Paused"}</StatusChip>
          </div>
          <div className="muted mono" style={{ marginTop: 12 }}>{policy.pubkey}</div>
        </div>
        <div className="card">
          <div className="card-title">Daily spend</div>
          <SpendGauge spentLamports={spentLamports} budgetLamports={policy.dailyBudgetLamports} />
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title">Recent activity</div>
          <div className="list">
            {(transactions?.items ?? []).slice(0, 6).map((txn) => (
              <TransactionRow key={txn.id} transaction={txn} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Incidents</div>
          {(incidents?.items ?? []).length ? (
            <div className="list">
              {(incidents?.items ?? []).map((incident) => (
                <Link key={incident.id} href={`/incidents/${incident.id}`} className="row-card">
                  {incident.reason}
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No incidents recorded for this policy.</div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
