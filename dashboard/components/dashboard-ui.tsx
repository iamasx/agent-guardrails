"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
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
  const { connected, publicKey } = useWallet();
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, toggleSidebarCollapsed, setSidebarOpen } = useLayoutStore();
  const walletAddress = publicKey ? shortAddress(publicKey.toBase58(), 4, 4) : "Not connected";
  const monitorLinks = [
    { href: "/agents", label: "Agents", icon: "A", badge: "5" },
    { href: "/activity", label: "Activity", icon: "V", badge: "21" },
    { href: "/incidents", label: "Incidents", icon: "I", badge: "2" },
  ];
  const setupLinks = [
    { href: "/agents/new", label: "New agent", icon: "+", badge: "•" },
    { href: "/signin", label: "Sign in", icon: "S" },
  ];
  const currentPath = pathname ?? "";
  const isLinkActive = (href: string, nested = true) =>
    href === "/" ? currentPath === "/" : currentPath === href || (nested && currentPath.startsWith(`${href}/`));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-row gap-0 overflow-x-hidden px-0 py-0 md:gap-0">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside className={`fixed left-0 top-0 z-40 flex h-full w-[min(16rem,90vw)] flex-col gap-4 border-r border-blue-900/30 bg-gradient-to-b from-[#0b101a] to-[#080c14] p-3 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out md:static md:z-0 md:h-screen md:w-44 md:shrink-0 md:translate-x-0 md:rounded-none md:border-r md:border-blue-900/30 md:bg-gradient-to-b md:from-[#0b101a] md:to-[#080c14] md:p-3 md:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? "md:w-16" : ""}`}>
        <div className={`flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2 py-2 ${sidebarCollapsed ? "md:justify-center" : ""}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-500/40">G</div>
          <div className={`flex flex-col gap-0.5 ${sidebarCollapsed ? "md:hidden" : ""}`}>
            <strong className="text-sm font-bold text-zinc-50">Guardrails</strong>
            <span className="text-xs text-blue-300/60">Solana - devnet</span>
          </div>
        </div>
        <button
          type="button"
          className="hidden mb-2 items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-400 transition-all duration-200 hover:border-blue-800/50 hover:bg-blue-950/30 hover:text-blue-200 md:inline-flex"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={sidebarCollapsed}
          onClick={toggleSidebarCollapsed}
        >
          {sidebarCollapsed ? ">>" : "<<"}
        </button>
        <nav className="mb-0 flex flex-col gap-1">
          <div className={`mb-1 mt-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 first:mt-0 ${sidebarCollapsed ? "md:hidden" : ""}`}>Monitor</div>
          {monitorLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`group rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isLinkActive(link.href, true)
                  ? "border-blue-700/50 bg-blue-950/60 text-blue-200 shadow-sm shadow-blue-900/30"
                  : "text-zinc-400 hover:border-blue-700/30 hover:bg-blue-950/30 hover:text-zinc-200"
              }`}
              aria-current={isLinkActive(link.href, true) ? "page" : undefined}
              onClick={() => setSidebarOpen(false)}
              title={link.label}
            >
              <span className="flex items-center gap-3">
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                  isLinkActive(link.href, true)
                    ? "border-blue-500/70 bg-blue-600/20 text-blue-100"
                    : "border-zinc-700/80 bg-zinc-900/60 text-zinc-400 group-hover:border-blue-700/60 group-hover:text-zinc-200"
                }`}>
                  {link.icon}
                </span>
                <span className={`${sidebarCollapsed ? "md:hidden" : ""}`}>{link.label}</span>
                {link.badge ? (
                  <span
                    className={`ml-auto inline-flex min-w-[1.35rem] items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold ${
                      isLinkActive(link.href, true)
                        ? "border-blue-500/50 bg-blue-600/20 text-blue-100"
                        : "border-zinc-700/70 bg-zinc-900/70 text-zinc-400"
                    } ${sidebarCollapsed ? "md:hidden" : ""}`}
                  >
                    {link.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
          <div className={`mb-1 mt-4 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 first:mt-0 ${sidebarCollapsed ? "md:hidden" : ""}`}>Setup</div>
          {setupLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`group rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isLinkActive(link.href, false)
                  ? "border-blue-700/50 bg-blue-950/60 text-blue-200 shadow-sm shadow-blue-900/30"
                  : "text-zinc-400 hover:border-blue-700/30 hover:bg-blue-950/30 hover:text-zinc-200"
              }`}
              aria-current={isLinkActive(link.href, false) ? "page" : undefined}
              onClick={() => setSidebarOpen(false)}
              title={link.label}
            >
              <span className="flex items-center gap-3">
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                  isLinkActive(link.href, false)
                    ? "border-blue-500/70 bg-blue-600/20 text-blue-100"
                    : "border-zinc-700/80 bg-zinc-900/60 text-zinc-400 group-hover:border-blue-700/60 group-hover:text-zinc-200"
                }`}>
                  {link.icon}
                </span>
                <span className={`${sidebarCollapsed ? "md:hidden" : ""}`}>{link.label}</span>
                {link.badge ? (
                  <span
                    className={`ml-auto inline-flex min-w-[1.35rem] items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold ${
                      isLinkActive(link.href, false)
                        ? "border-blue-500/50 bg-blue-600/20 text-blue-100"
                        : "border-zinc-700/70 bg-zinc-900/70 text-zinc-400"
                    } ${sidebarCollapsed ? "md:hidden" : ""}`}
                  >
                    {link.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </nav>
        <div className={`mt-auto flex items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/60 p-3 transition-all duration-200 hover:border-blue-800/40 hover:bg-zinc-900/80 ${sidebarCollapsed ? "md:justify-center" : ""}`}>
          <div
            className={`h-2 w-2 rounded-full shadow-lg ${connected ? "bg-emerald-400 shadow-emerald-400/60" : "bg-zinc-500 shadow-zinc-500/40"}`}
          />
          <div className={`flex min-w-0 flex-col gap-0.5 ${sidebarCollapsed ? "md:hidden" : ""}`}>
            <span className="text-xs text-zinc-500">{connected ? "Connected wallet" : "Wallet status"}</span>
            <strong className="truncate text-xs font-semibold text-zinc-300">{walletAddress}</strong>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-6 md:px-8 md:py-7">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-blue-900/20 pb-4 md:gap-6">
          <div className="min-w-0 pr-2">
            <div className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">{title}</div>
            {subtitle ? <div className="mt-2 text-sm text-zinc-400">{subtitle}</div> : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            <button
              className="rounded-lg border border-blue-800/50 bg-zinc-900/50 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-all duration-200 hover:border-blue-700/70 hover:bg-blue-950/40 hover:text-blue-100 active:bg-blue-950/50 md:hidden"
              type="button"
              onClick={toggleSidebar}
            >
              {sidebarOpen ? "Hide nav" : "Menu"}
            </button>
            {actions}
            <WalletControls />
          </div>
        </header>
        <div className="animate-[fade-in-up_220ms_ease-out]">{children}</div>
      </main>
    </div>
  );
}

export function StatusChip({ tone, children }: { tone: "green" | "amber" | "red"; children: ReactNode }) {
  const toneClasses = {
    green: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-emerald-500/10",
    amber: "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-amber-500/10",
    red: "bg-red-500/20 text-red-300 border border-red-500/30 shadow-red-500/10",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${toneClasses[tone]}`}>{children}</span>;
}

export function PolicyCard({ policy }: { policy: PolicySummary }) {
  const tone = statusTone(policy);
  const spent = lamportsToSol(policy.dailySpentLamports ?? "0");
  const budget = lamportsToSol(policy.dailyBudgetLamports);
  const displayBudget = budget > 0 && budget < 1 ? budget.toFixed(2) : budget.toFixed(0);
  const spendPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const progressTone = spendPct >= 90 ? "bg-red-500" : spendPct >= 66 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <Link href={`/agents/${policy.pubkey}`} className="cursor-pointer rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 shadow-lg shadow-blue-950/20 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-800/60 hover:bg-gradient-to-br hover:from-zinc-900/90 hover:to-zinc-900/50 hover:shadow-xl hover:shadow-blue-900/30 active:translate-y-0 active:shadow-md active:shadow-blue-900/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Agent</div>
          <div className="mt-1 text-2xl font-bold text-zinc-100">{policy.label ?? shortAddress(policy.pubkey, 6, 4)}</div>
        </div>
        <StatusChip tone={tone}>
          {!policy.isActive ? "Paused" : new Date(policy.sessionExpiry).getTime() < Date.now() ? "Expired" : "Active"}
        </StatusChip>
      </div>
      <div className="mt-4 text-xs text-zinc-500">Daily spend</div>
      <div className="mt-1 flex items-center justify-between text-sm text-zinc-300">
        <span>{spent.toFixed(2)}</span>
        <span>/ {displayBudget} SOL</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${progressTone}`} style={{ width: `${spendPct}%` }} />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-4">
        <Metric label="Session" value={formatRelativeTime(policy.sessionExpiry)} />
        <Metric label="Per tx cap" value={`${lamportsToSol(policy.maxTxLamports)} SOL`} />
        <Metric label="Daily budget" value={`${displayBudget} SOL`} />
      </div>
      <div className="text-sm text-zinc-500" style={{ marginTop: 16 }}>
        Programs: {policy.allowedPrograms.slice(0, 3).map(programLabel).join(", ")}
        {policy.allowedPrograms.length > 3 ? ` +${policy.allowedPrograms.length - 3}` : ""}
      </div>
    </Link>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-100">{value}</div>
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
      <div className="rounded-lg border border-dashed border-zinc-700/50 bg-zinc-900/30 py-8 px-4 text-center text-sm text-zinc-400 transition-colors duration-200" style={{ marginTop: 12 }}>
        No budget set.
      </div>
    );
  }

  return (
    <div className="mx-auto max-h-[min(220px,50vw)] w-full max-w-full">
      <ResponsiveContainer width="100%" height={220}>
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
            <div className="text-2xl font-bold text-zinc-100" style={{ color: "#ff6b6b" }}>
              OVER BUDGET
            </div>
            <div className="text-sm text-zinc-500">
              {spent.toFixed(1)} / {budget.toFixed(1)} SOL
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold text-zinc-100">{spent.toFixed(1)} SOL</div>
            <div className="text-sm text-zinc-500">of {budget.toFixed(1)} SOL budget</div>
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
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-5 transition-all duration-200 hover:border-zinc-700/70 hover:bg-zinc-900/60 cursor-pointer">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <StatusChip tone={tone === "slate" ? "green" : tone}>{verdict.toUpperCase()}</StatusChip>
            <strong>{programLabel(transaction.targetProgram)}</strong>
            {showAgent ? <span className="text-sm text-zinc-500">{policyLabel(transaction.policyPubkey)}</span> : null}
          </div>
          <div className="text-sm text-zinc-500" style={{ marginTop: 8 }}>
            {transaction.verdict?.reasoning ?? "No anomaly reasoning stored for this transaction."}
          </div>
        </div>
        <div className="min-w-0 shrink-0 text-left sm:text-right">
          <div className="text-base font-bold text-zinc-100">
            {transaction.amountLamports ? `${lamportsToSol(transaction.amountLamports).toFixed(2)} SOL` : "—"}
          </div>
          <div className="text-sm text-zinc-500">{formatRelativeTime(transaction.blockTime)}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mt-3 text-sm text-zinc-500">
        <span className="font-mono text-xs text-zinc-400 sm:text-sm min-w-0 break-all">{shortAddress(transaction.txnSig, 10, 8)}</span>
        <span className="shrink-0 whitespace-nowrap">{formatDateTime(transaction.blockTime)}</span>
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
    <div className="flex flex-col gap-4 border-l-2 border-blue-900/40 pl-6">
      {items.map((item) => (
        <div key={`${item.time}-${item.title}`} className={`relative pl-4 pb-2 ${
          item.tone === "red" ? "" :
          item.tone === "amber" ? "" :
          item.tone === "green" ? "" :
          ""
        }`}>
          <div className={`absolute left-[-1.65rem] top-1 h-3 w-3 rounded-full border-2 ${
            item.tone === "red" ? "border-red-500 bg-red-500/20" :
            item.tone === "amber" ? "border-amber-500 bg-amber-500/20" :
            item.tone === "green" ? "border-emerald-500 bg-emerald-500/20" :
            "border-blue-900/50 bg-zinc-950"
          }`} />
          <div className="font-mono text-xs text-zinc-400 sm:text-sm">{item.time}</div>
          <strong className={`${
            item.tone === "red" ? "text-red-300" :
            item.tone === "amber" ? "text-amber-200" :
            item.tone === "green" ? "text-emerald-300" :
            ""
          }`}>{item.title}</strong>
          <div className="text-sm text-zinc-500">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

export function IncidentTable({ incidents }: { incidents: IncidentSummary[] }) {
  if (!incidents.length) {
    return <div className="rounded-lg border border-dashed border-zinc-700/50 bg-zinc-900/30 py-8 px-4 text-center text-sm text-zinc-400 transition-colors duration-200">No incidents yet.</div>;
  }

  return (
    <div className="rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-0 sm:p-6 shadow-lg shadow-blue-950/20 backdrop-blur-sm transition-all duration-300">
      <div className="-mx-6 overflow-x-auto md:mx-0">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-blue-900/30 bg-zinc-900/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Agent</th>
              <th className="border-b border-blue-900/30 bg-zinc-900/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Reason</th>
              <th className="border-b border-blue-900/30 bg-zinc-900/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Paused at</th>
              <th className="border-b border-blue-900/30 bg-zinc-900/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id} className="transition-all duration-150 hover:bg-blue-950/15">
                <td className="border-b border-zinc-800/40 px-4 py-3 text-zinc-300 max-w-[10rem] truncate sm:max-w-none sm:whitespace-normal">
                  <Link href={`/incidents/${incident.id}`}>{policyLabel(incident.policyPubkey)}</Link>
                </td>
                <td className="border-b border-zinc-800/40 px-4 py-3 text-zinc-300 max-w-[12rem] truncate sm:max-w-none sm:whitespace-normal">{incident.reason}</td>
                <td className="border-b border-zinc-800/40 px-4 py-3 text-zinc-300 whitespace-nowrap">{formatDateTime(incident.pausedAt)}</td>
                <td className="border-b border-zinc-800/40 px-4 py-3 text-zinc-300">
                  <StatusChip tone={incident.resolvedAt ? "green" : "red"}>{incident.resolvedAt ? "Resolved" : "Active"}</StatusChip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

