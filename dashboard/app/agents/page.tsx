import { AppShell } from "@/components/dashboard-ui";
import { AgentsOverview } from "@/app/agents/agents-overview";

export default function AgentsPage() {
  return (
    <AppShell
      title="Agents"
      subtitle="Policies owned by your wallet will appear here."
    >
      <AgentsOverview />
    </AppShell>
  );
}
