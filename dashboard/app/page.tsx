import Link from "next/link";
import { LandingConnectWalletButton } from "@/components/landing-connect-wallet-button";
import { WalletControls } from "@/components/wallet-controls";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07080c] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-[#1e2433] bg-[#07080c]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 md:px-8">
          <div className="text-sm text-zinc-400">Home</div>
          <WalletControls />
        </div>
      </header>

      <h1 className="sr-only">Agent Guardrails landing page</h1>

      <section className="relative overflow-hidden border-b border-[#1e2433] px-4 pb-16 pt-20 sm:px-6 md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_50%_30%,black_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute left-1/2 top-[-80px] h-[380px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.24),transparent_62%)] blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-blue-200">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.85)]" />
            Live on Solana devnet
          </p>

          <h2 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl md:text-6xl">
            On-chain{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              guardrails
            </span>
            <br />
            for AI agents
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm text-zinc-300 sm:text-base">
            A programmable policy layer that sits between your agent&apos;s session key and the blockchain.
            Allow-list programs, cap spend, and stop compromised agents the moment they misbehave.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LandingConnectWalletButton />
            <Link
              href="/incidents"
              className="inline-flex items-center justify-center rounded-lg border border-[#2a3142] bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-[#384056] hover:bg-[#10131c]"
            >
              View demo incident
            </Link>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
            <StatCard number="3" label="Agents protected" tone="text-emerald-400" />
            <StatCard number="22" label="Transactions guarded" />
            <StatCard number="1" label="Attack stopped" tone="text-red-400" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-16 sm:px-6 md:grid-cols-3 md:px-8">
        <FeatureCard
          title="Program allow-listing"
          description="Every outbound CPI is gated against a whitelist of program addresses. Unknown calls revert before any lamports move."
          iconPath="M12 3l8 3v6c0 5-3.5 8.8-8 10-4.5-1.2-8-5-8-10V6l8-3zm0 4.2v9.4"
        />
        <FeatureCard
          title="Rolling spend budgets"
          description="Per-transaction caps and 24-hour spend windows are enforced atomically so budgets roll forward consistently."
          iconPath="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 4v4l3 2.5"
        />
        <FeatureCard
          title="AI kill switch"
          description="A judge monitors every transaction and can trigger on-chain pause logic in seconds when draining patterns are detected."
          iconPath="M13 2L3 14h7l-1 8 10-12h-7l1-8z"
        />
      </section>
    </main>
  );
}

function StatCard({
  number,
  label,
  tone = "text-zinc-100",
}: {
  number: string;
  label: string;
  tone?: string;
}) {
  return (
    <article className="rounded-xl border border-[#1e2433] bg-[#0b0d14] p-5">
      <div className={`font-mono text-3xl font-medium tracking-tight ${tone}`}>{number}</div>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </article>
  );
}

function FeatureCard({
  title,
  description,
  iconPath,
}: {
  title: string;
  description: string;
  iconPath: string;
}) {
  return (
    <article className="rounded-xl border border-[#1e2433] bg-[#0b0d14] p-6 transition hover:border-[#2a3142]">
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-500/35 bg-blue-500/10">
        <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5 stroke-blue-300 stroke-[1.8]">
          <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold tracking-tight text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </article>
  );
}
