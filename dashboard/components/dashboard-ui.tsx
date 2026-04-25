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
    <div className="flex min-h-screen w-full overflow-x-hidden bg-[#07080c] text-[#e6e9f2]">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside className={`fixed left-0 top-0 z-40 flex h-full w-[min(17rem,90vw)] flex-col gap-1 border-r border-[#1e2433] bg-[#0b0d14] px-3 py-5 shadow-2xl transition-transform duration-300 ease-out md:static md:z-0 md:h-screen md:w-60 md:shrink-0 md:translate-x-0 md:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? "md:w-[4.5rem]" : ""}`}>
        <div className={`mb-4 flex items-center gap-2 px-2 ${sidebarCollapsed ? "md:justify-center" : ""}`}>
          <div className="relative h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 shadow-[0_0_14px_rgba(59,130,246,0.35)] after:absolute after:inset-[5px] after:rounded-[3px] after:border after:border-white/90 after:content-['']" />
          <div className={`${sidebarCollapsed ? "md:hidden" : ""}`}>
            <div className="text-sm font-semibold">Guardrails</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#5b6479]">Solana Devnet</div>
          </div>
        </div>

        <button
          type="button"
          className="mb-2 hidden items-center justify-center rounded-md border border-[#2a3142] bg-[#10131c] px-2 py-1.5 text-xs text-[#8a93a8] hover:border-[#384056] md:inline-flex"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={sidebarCollapsed}
          onClick={toggleSidebarCollapsed}
        >
          {sidebarCollapsed ? ">>" : "<<"}
        </button>
        <nav className="mb-0 flex flex-col gap-1">
          <div className={`mb-1 mt-2 px-2 text-[10px] uppercase tracking-[0.14em] text-[#5b6479] ${sidebarCollapsed ? "md:hidden" : ""}`}>Monitor</div>
          {monitorLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`group rounded-md px-2.5 py-2 text-[13px] transition-all ${
                isLinkActive(link.href, true)
                  ? "bg-blue-500/10 text-[#e6e9f2] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]"
                  : "text-[#8a93a8] hover:bg-[#10131c] hover:text-[#e6e9f2]"
              }`}
              aria-current={isLinkActive(link.href, true) ? "page" : undefined}
              onClick={() => setSidebarOpen(false)}
              title={link.label}
            >
              <span className="flex items-center gap-3">
                <span className={`h-1 w-1 rounded-full ${isLinkActive(link.href, true) ? "bg-blue-500" : "bg-transparent"}`} />
                <span className={`${sidebarCollapsed ? "md:hidden" : ""}`}>{link.label}</span>
                {link.badge ? (
                  <span
                    className={`ml-auto inline-flex min-w-[1.35rem] items-center justify-center rounded-md px-1.5 text-[11px] ${
                      isLinkActive(link.href, true)
                        ? "text-[#8a93a8]"
                        : "text-[#5b6479]"
                    } ${sidebarCollapsed ? "md:hidden" : ""}`}
                  >
                    {link.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
          <div className={`mb-1 mt-4 px-2 text-[10px] uppercase tracking-[0.14em] text-[#5b6479] ${sidebarCollapsed ? "md:hidden" : ""}`}>Setup</div>
          {setupLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`group rounded-md px-2.5 py-2 text-[13px] transition-all ${
                isLinkActive(link.href, false)
                  ? "bg-blue-500/10 text-[#e6e9f2] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]"
                  : "text-[#8a93a8] hover:bg-[#10131c] hover:text-[#e6e9f2]"
              }`}
              aria-current={isLinkActive(link.href, false) ? "page" : undefined}
              onClick={() => setSidebarOpen(false)}
              title={link.label}
            >
              <span className="flex items-center gap-3">
                <span className={`h-1 w-1 rounded-full ${isLinkActive(link.href, false) ? "bg-blue-500" : "bg-transparent"}`} />
                <span className={`${sidebarCollapsed ? "md:hidden" : ""}`}>{link.label}</span>
                {link.badge ? (
                  <span
                    className={`ml-auto inline-flex min-w-[1.35rem] items-center justify-center rounded-md px-1.5 text-[11px] ${
                      isLinkActive(link.href, false)
                        ? "text-[#8a93a8]"
                        : "text-[#5b6479]"
                    } ${sidebarCollapsed ? "md:hidden" : ""}`}
                  >
                    {link.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </nav>
        <div className={`mt-auto border-t border-[#1e2433] px-2 pt-3 ${sidebarCollapsed ? "md:px-1" : ""}`}>
          <div className={`flex items-center gap-2 rounded-md border border-[#1e2433] bg-[#10131c] px-2.5 py-2 ${sidebarCollapsed ? "md:justify-center" : ""}`}>
            <span className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500" />
            <div className={`${sidebarCollapsed ? "md:hidden" : ""}`}>
              <div className="text-[11px] text-[#5b6479]">{connected ? "Connected wallet" : "Wallet status"}</div>
              <div className="text-xs text-[#e6e9f2]">{walletAddress}</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-[#1e2433] bg-[#07080c]/90 px-5 backdrop-blur md:px-7">
          <div className="text-sm text-[#8a93a8]">
            Dashboard <span className="px-1 text-[#5b6479]">/</span> <span className="text-[#e6e9f2]">{title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded-md border border-[#2a3142] bg-[#10131c] px-3 py-1.5 text-xs text-[#8a93a8] md:hidden"
              type="button"
              onClick={toggleSidebar}
            >
              {sidebarOpen ? "Close" : "Menu"}
            </button>
            <WalletControls />
          </div>
        </header>
        <div className="px-5 py-7 md:px-8 md:py-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="mt-1 text-[13px] text-[#8a93a8]">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </header>
          <div className="animate-[fade-in-up_220ms_ease-out]">{children}</div>
        </div>
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
  const spent = lamportsToSol(policy.dailySpentLamports ?? "0");
  const budget = lamportsToSol(policy.dailyBudgetLamports);
  const displayBudget = budget > 0 && budget < 1 ? budget.toFixed(2) : budget.toFixed(0);
  const spendPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const progressTone = spendPct >= 90 ? "bg-red-500" : spendPct >= 66 ? "bg-amber-400" : "bg-emerald-400";
  const sessionExpired = new Date(policy.sessionExpiry).getTime() < Date.now();

  return (
    <Link
      href={`/agents/${policy.pubkey}`}
      className="block rounded-xl border border-[#1e2433] bg-[#0b0d14] p-5 transition hover:-translate-y-0.5 hover:border-[#2a3142] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_0_24px_rgba(59,130,246,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[15px] font-semibold tracking-tight ${policy.label ? "" : "italic text-[#5b6479]"}`}>
            {policy.label ?? "Unlabeled agent"}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px] text-[#5b6479]">
            {shortAddress(policy.pubkey, 6, 6)}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {!policy.isActive ? (
            <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-300">
              PAUSED
            </span>
          ) : sessionExpired ? (
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-200">
              SESSION EXPIRED
            </span>
          ) : (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
              ACTIVE
            </span>
          )}
          {policy.squadsMultisig ? (
            <span className="rounded border border-blue-500/35 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] text-blue-200">
              SQUADS
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-[#8a93a8]">
          <span>Daily spend</span>
          <span className="font-mono text-[#e6e9f2]">
            {spent.toFixed(2)} <span className="text-[#8a93a8]">/ {displayBudget} SOL</span>
          </span>
        </div>
        <div className="h-1.5 rounded bg-[#151925]">
          <div className={`h-full rounded ${progressTone}`} style={{ width: `${spendPct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed border-[#1e2433] pt-3">
        <div>
          <div className="mb-0.5 text-[10.5px] uppercase tracking-[0.08em] text-[#5b6479]">Session</div>
          <div className="font-mono text-xs text-[#e6e9f2]">{formatRelativeTime(policy.sessionExpiry)}</div>
        </div>
        <div>
          <div className="mb-0.5 text-[10.5px] uppercase tracking-[0.08em] text-[#5b6479]">Per tx cap</div>
          <div className="font-mono text-xs text-[#e6e9f2]">{lamportsToSol(policy.maxTxLamports)} SOL</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-[#8a93a8]">
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
  const toneClasses: Record<"green" | "amber" | "red" | "blue", string> = {
    green: "bg-emerald-500 shadow-[0_0_0_1px_#22c55e,0_0_12px_rgba(34,197,94,0.5)]",
    amber: "bg-amber-500 shadow-[0_0_0_1px_#f59e0b,0_0_12px_rgba(245,158,11,0.5)]",
    red: "bg-red-500 shadow-[0_0_0_1px_#ef4444,0_0_12px_rgba(239,68,68,0.5)]",
    blue: "bg-blue-500 shadow-[0_0_0_1px_#3b82f6,0_0_12px_rgba(59,130,246,0.5)]",
  };

  return (
    <div className="relative pl-8 before:absolute before:bottom-1.5 before:left-[7px] before:top-1.5 before:w-px before:bg-[#2a3142] before:content-['']">
      {items.map((item) => (
        <div key={`${item.time}-${item.title}`} className="relative pb-4 last:pb-0">
          <span className={`absolute -left-8 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#07080c] ${toneClasses[item.tone]}`} />
          <div className="font-mono text-[11.5px] tracking-[0.04em] text-[#5b6479]">{item.time}</div>
          <div className="mt-0.5 text-[13px] font-medium text-[#e6e9f2]">{item.title}</div>
          <div className="mt-1 font-mono text-[12.5px] text-[#8a93a8]">{item.detail}</div>
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
    <div className="overflow-hidden rounded-xl border border-[#1e2433] bg-[#0b0d14]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-[#1e2433] bg-[#10131c] px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#5b6479]">Agent</th>
              <th className="border-b border-[#1e2433] bg-[#10131c] px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#5b6479]">Reason</th>
              <th className="border-b border-[#1e2433] bg-[#10131c] px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#5b6479]">Paused at</th>
              <th className="border-b border-[#1e2433] bg-[#10131c] px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#5b6479]">Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id} className="cursor-pointer transition-colors hover:bg-[#10131c]">
                <td className="border-b border-[#1e2433] px-4 py-3.5 text-[#e6e9f2] max-w-[10rem] truncate sm:max-w-none sm:whitespace-normal">
                  <Link href={`/incidents/${incident.id}`} className="hover:text-blue-300">
                    {policyLabel(incident.policyPubkey)}
                  </Link>
                </td>
                <td className="border-b border-[#1e2433] px-4 py-3.5 text-[#8a93a8] max-w-[12rem] truncate sm:max-w-none sm:whitespace-normal">{incident.reason}</td>
                <td className="border-b border-[#1e2433] px-4 py-3.5 font-mono text-[#8a93a8] whitespace-nowrap">{formatDateTime(incident.pausedAt)}</td>
                <td className="border-b border-[#1e2433] px-4 py-3.5 text-[#8a93a8]">
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

