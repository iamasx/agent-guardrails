import { AppShell } from "@/components/app-shell";

export default function AgentsPage() {
  return (
    <AppShell
      title="Agents"
      subtitle="Policies owned by your wallet will appear here."
    >
      <div className="empty">Agent cards and query-backed data are added in upcoming phases.</div>
    </AppShell>
  );
}
