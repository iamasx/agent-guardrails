"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import type { ReactNode } from "react";
import {
  effectiveVerdict,
  policyLabel,
  programLabel,
  shortAddress,
  formatDateTime,
  formatRelativeTime,
  lamportsToSol,
  statusTone,
  verdictTone,
} from "@/lib/utils";
import type { IncidentSummary, PolicySummary, TransactionSummary } from "@/lib/types/dashboard";
import { useLayoutStore } from "@/lib/stores/layout";
import { WalletControls } from "./wallet-controls";

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useLayoutStore();
  const links = [
    { href: "/", label: "Overview" },
    { href: "/agents", label: "Agents" },
    { href: "/activity", label: "Activity" },
    { href: "/incidents", label: "Incidents" },
    { href: "/signin", label: "Sign In" },
  ];

  return (
    <div className="shell">
      <aside className="sidebar" style={{ display: sidebarOpen ? "block" : "none" }}>
        <div className="brand">
          <div className="brand-mark">G</div>
          <div className="brand-copy">
            <strong>Guardrails</strong>
            <span>Agent oversight dashboard</span>
          </div>
        </div>
        <nav className="nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href ? "active" : ""}`}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <div className="page-title">{title}</div>
            {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
          </div>
          <div className="toolbar">
            <button className="button button-secondary" type="button" onClick={toggleSidebar}>
              {sidebarOpen ? "Hide nav" : "Show nav"}
            </button>
            {actions}
            <WalletControls />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function StatusChip({ tone, children }: { tone: "green" | "amber" | "red"; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function PolicyCard({ policy }: { policy: PolicySummary }) {
  const tone = statusTone(policy);
  return (
    <Link href={`/agents/${policy.pubkey}`} className="card">
      <div className="spread">
        <div>
          <div className="card-title">Agent</div>
          <div className="metric-value">{policy.label ?? shortAddress(policy.pubkey, 6, 4)}</div>
        </div>
        <StatusChip tone={tone}>
          {!policy.isActive ? "Paused" : new Date(policy.sessionExpiry).getTime() < Date.now() ? "Expired" : "Active"}
        </StatusChip>
      </div>
      <div className="grid three" style={{ marginTop: 16 }}>
        <Metric label="Daily budget" value={`${lamportsToSol(policy.dailyBudgetLamports)} SOL`} />
        <Metric label="Per tx cap" value={`${lamportsToSol(policy.maxTxLamports)} SOL`} />
        <Metric label="Session" value={formatRelativeTime(policy.sessionExpiry)} />
      </div>
      <div className="muted" style={{ marginTop: 16 }}>
        Programs: {policy.allowedPrograms.slice(0, 3).map(programLabel).join(", ")}
        {policy.allowedPrograms.length > 3 ? ` +${policy.allowedPrograms.length - 3}` : ""}
      </div>
    </Link>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export function SpendGauge({ spentLamports, budgetLamports }: { spentLamports: string; budgetLamports: string }) {
  const spent = lamportsToSol(spentLamports);
  const budget = lamportsToSol(budgetLamports);
  const ratio = budget === 0 ? 0 : (spent / budget) * 100;
  const clampedRatio = Math.min(ratio, 100);
  const tone = ratio >= 90 ? "#ff6b6b" : ratio >= 66 ? "#ffb84d" : "#29c780";

  if (budget <= 0) {
    return (
      <div className="card empty" style={{ marginTop: 12 }}>
        No budget set.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          barSize={18}
          data={[{ value: clampedRatio, fill: tone }]}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar background dataKey="value" cornerRadius={16} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: -128, textAlign: "center" }}>
        {ratio > 100 ? (
          <>
            <div className="metric-value" style={{ color: "#ff6b6b" }}>
              OVER BUDGET
            </div>
            <div className="muted">
              {spent.toFixed(1)} / {budget.toFixed(1)} SOL
            </div>
          </>
        ) : (
          <>
            <div className="metric-value">{spent.toFixed(1)} SOL</div>
            <div className="muted">of {budget.toFixed(1)} SOL budget</div>
          </>
        )}
      </div>
    </div>
  );
}

export function TransactionRow({
  transaction,
  showAgent = false,
}: {
  transaction: TransactionSummary;
  showAgent?: boolean;
}) {
  const verdict = effectiveVerdict(transaction.verdict?.verdict);
  const tone = verdictTone(verdict);
  return (
    <div className="row-card">
      <div className="row-main">
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <StatusChip tone={tone === "slate" ? "green" : tone}>{verdict.toUpperCase()}</StatusChip>
            <strong>{programLabel(transaction.targetProgram)}</strong>
            {showAgent ? <span className="muted">{policyLabel(transaction.policyPubkey)}</span> : null}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            {transaction.verdict?.reasoning ?? "No anomaly reasoning stored for this transaction."}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="metric-value" style={{ fontSize: "1rem" }}>
            {transaction.amountLamports ? `${lamportsToSol(transaction.amountLamports).toFixed(2)} SOL` : "—"}
          </div>
          <div className="muted">{formatRelativeTime(transaction.blockTime)}</div>
        </div>
      </div>
      <div className="spread muted" style={{ marginTop: 12 }}>
        <span className="mono">{shortAddress(transaction.txnSig, 10, 8)}</span>
        <span>{formatDateTime(transaction.blockTime)}</span>
      </div>
    </div>
  );
}

export function IncidentTimeline({
  items,
}: {
  items: Array<{ time: string; title: string; detail: string; tone: "green" | "amber" | "red" | "blue" }>;
}) {
  return (
    <div className="timeline">
      {items.map((item) => (
        <div key={`${item.time}-${item.title}`} className={`timeline-item ${item.tone === "blue" ? "" : item.tone}`}>
          <div className="muted mono">{item.time}</div>
          <strong>{item.title}</strong>
          <div className="muted">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

export function IncidentTable({ incidents }: { incidents: IncidentSummary[] }) {
  if (!incidents.length) {
    return <div className="card empty">No incidents yet.</div>;
  }

  return (
    <div className="card">
      <table className="table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Reason</th>
            <th>Paused at</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id}>
              <td>
                <Link href={`/incidents/${incident.id}`}>{policyLabel(incident.policyPubkey)}</Link>
              </td>
              <td>{incident.reason}</td>
              <td>{formatDateTime(incident.pausedAt)}</td>
              <td>
                <StatusChip tone={incident.resolvedAt ? "green" : "red"}>{incident.resolvedAt ? "Resolved" : "Active"}</StatusChip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SimpleMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  return (
    <div className="markdown">
      {lines.map((line, index) => {
        if (line.startsWith("# ")) return <h1 key={index}>{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={index}>{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={index}>{line.slice(4)}</h3>;
        if (line.startsWith("- ")) return <li key={index}>{line.slice(2)}</li>;
        if (line.startsWith("|")) return <pre key={index}>{line}</pre>;
        if (!line.trim()) return <br key={index} />;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}
