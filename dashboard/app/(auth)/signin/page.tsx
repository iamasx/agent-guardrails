import { AppShell } from "@/components/app-shell";

export default function SignInPage() {
  return (
    <AppShell
      title="Sign In"
      subtitle="Authenticate with your wallet using SIWS."
    >
      <div className="empty">SIWS nonce/sign/verify flow is implemented in Phase 3.</div>
    </AppShell>
  );
}
