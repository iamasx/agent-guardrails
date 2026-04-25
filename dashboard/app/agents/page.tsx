import { AppShell } from "@/components/dashboard-ui";
import { AgentsOverview } from "@/app/agents/agents-overview";
import Link from "next/link";

export default function AgentsPage() {
  return (
    <AppShell
      title="Agents"
      subtitle="Policies owned by your wallet."
      actions={(
        <Link
          href="/agents/new"
          className="button button-primary px-3.5 py-2"
        >
          New Agent
        </Link>
      )}
    >
      <AgentsOverview />
    </AppShell>
  );
}
