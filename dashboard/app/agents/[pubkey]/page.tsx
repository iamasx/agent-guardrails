import { AgentDetailView } from "@/app/agents/[pubkey]/agent-detail-view";

export default function AgentDetailPage({ params }: { params: { pubkey: string } }) {
  return <AgentDetailView pubkey={params.pubkey} />;
}
