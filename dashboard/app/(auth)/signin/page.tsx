import { AppShell } from "@/components/app-shell";
import { SiwsSignIn } from "@/components/auth/siws-sign-in";

export default function SignInPage() {
  return (
    <AppShell
      title="Sign In"
      subtitle="Authenticate with your wallet using SIWS."
    >
      <SiwsSignIn />
    </AppShell>
  );
}
