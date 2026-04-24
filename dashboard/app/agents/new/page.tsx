import { AppShell } from "@/components/dashboard-ui";
import { CreatePolicyWizard } from "@/components/create-policy-wizard/CreatePolicyWizard";

export default function NewAgentPage() {
  return (
    <AppShell
      title="Create Policy"
      subtitle="Define program allow-lists, spend limits, and escalation controls."
    >
      <CreatePolicyWizard />
    </AppShell>
  );
}
