import { AppShell } from "@/components/app-shell";

export default function EditPolicyPage({ params }: { params: { pubkey: string } }) {
  const shortenedPubkey =
    params.pubkey.length > 8
      ? `${params.pubkey.slice(0, 4)}...${params.pubkey.slice(-4)}`
      : params.pubkey;

  return (
    <AppShell
      title="Edit Policy"
      subtitle="Update limits, session expiry, and allowed programs."
    >
      <div className="empty">Policy editor for {shortenedPubkey} is planned for Phase 4.</div>
    </AppShell>
  );
}
