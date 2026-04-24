import { IncidentDetailView } from "@/app/incidents/[id]/incident-detail-view";

export default function IncidentDetailPage({ params }: { params: { id: string } }) {
  return <IncidentDetailView id={params.id} />;
}
