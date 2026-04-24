import { AppShell } from "@/components/app-shell";
import { EditPolicyForm } from "@/components/edit-policy-form";

export default function EditPolicyPage({ params }: { params: { pubkey: string } }) {
  return (
    <AppShell
      title="Edit Policy"
      subtitle="Update limits, session expiry, and allowed programs on-chain."
    >
      <EditPolicyForm policyPubkey={params.pubkey} />
    </AppShell>
  );
}
