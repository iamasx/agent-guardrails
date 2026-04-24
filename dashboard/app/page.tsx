import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell
      title="Agent Guardrails Protocol"
      subtitle="Solana policy controls for autonomous agents."
    >
      <div className="empty">
        Phase 1 scaffold complete. Connect wallet and SIWS flows are wired in later phases.
      </div>
    </AppShell>
  );
}
