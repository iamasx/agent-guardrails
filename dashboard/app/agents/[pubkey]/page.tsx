import { AppShell } from "@/components/app-shell";

export default function AgentDetailPage({ params }: { params: { pubkey: string } }) {
  const shortenedPubkey =
    params.pubkey.length > 8
      ? `${params.pubkey.slice(0, 4)}...${params.pubkey.slice(-4)}`
      : params.pubkey;

  return (
    <AppShell
      title="Agent Detail"
      subtitle="Live status, spend view, and recent guarded activity."
    >
      <div className="empty">Agent pubkey: {shortenedPubkey}</div>
    </AppShell>
  );
}
