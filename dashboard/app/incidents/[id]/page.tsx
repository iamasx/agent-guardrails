import { AppShell } from "@/components/app-shell";

export default function IncidentDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell
      title="Incident Detail"
      subtitle="Timeline and model reasoning for a specific pause."
    >
      <div className="empty">Incident id: {params.id}</div>
    </AppShell>
  );
}
