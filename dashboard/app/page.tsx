import Link from "next/link";
import { WalletControls } from "@/components/wallet-controls";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <header className="mb-8 flex items-center justify-between border-b border-zinc-800/50 pb-6">
        <div className="text-sm text-zinc-400">Home</div>
        <WalletControls />
      </header>
      <h1 className="sr-only">Agent Guardrails Protocol</h1>
      <section className="relative overflow-hidden rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 shadow-lg shadow-blue-950/20 backdrop-blur-sm transition-all duration-300">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.2),transparent_45%)]" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-blue-800/70 bg-blue-950/45 px-3 py-1 text-xs font-medium uppercase tracking-wide text-blue-200">
              Real-time AI Agent Safety
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Guard autonomous agents with policy controls and live incident response.
            </h2>
            <p className="mt-4 max-w-2xl text-sm text-zinc-300 sm:text-base">
              Monitor transactions, enforce spend limits, auto-pause suspicious behavior, and review full
              postmortems in one operator dashboard built for Solana-native teams.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signin" className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all duration-200 hover:from-blue-500 hover:to-blue-400 hover:shadow-xl hover:shadow-blue-500/40 active:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                Sign in with wallet
              </Link>
              <Link href="/agents" className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-800/50 bg-zinc-900/50 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-all duration-200 hover:border-blue-700/70 hover:bg-blue-950/40 hover:text-blue-100 active:bg-blue-950/50 focus-visible:ring-2 focus-visible:ring-offset-2">
                Explore agents
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-blue-900/50 bg-zinc-900/70 p-5 shadow-[0_18px_42px_-28px_rgba(59,130,246,0.7)]">
            <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Live posture snapshot</div>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-2">
                <span className="text-sm text-zinc-400">Guarded transactions</span>
                <strong className="text-zinc-100">24h stream</strong>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-2">
                <span className="text-sm text-zinc-400">Auto-pauses</span>
                <strong className="text-amber-300">On anomaly</strong>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-3 py-2">
                <span className="text-sm text-zinc-400">Reports</span>
                <strong className="text-blue-200">Timeline + reasoning</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 shadow-lg shadow-blue-950/20 backdrop-blur-sm transition-all duration-300">
          <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Policy enforcement</div>
          <h3 className="mt-2 text-lg font-semibold text-zinc-100">Program allow-lists and budget limits</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Define exactly where agents can transact and cap risk with per-transaction and daily limits.
          </p>
        </article>
        <article className="rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 shadow-lg shadow-blue-950/20 backdrop-blur-sm transition-all duration-300">
          <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Live operations</div>
          <h3 className="mt-2 text-lg font-semibold text-zinc-100">Activity feed with model verdicts</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Track every guarded transaction in real time with ALLOW, FLAG, and PAUSE decisions.
          </p>
        </article>
        <article className="rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 shadow-lg shadow-blue-950/20 backdrop-blur-sm transition-all duration-300">
          <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">Incident response</div>
          <h3 className="mt-2 text-lg font-semibold text-zinc-100">Immediate pause and investigation</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Review incident timelines and generated reports to harden policy settings after each event.
          </p>
        </article>
      </section>
    </main>
  );
}
