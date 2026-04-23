import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";

export const metadata: Metadata = {
  title: "Guardrails Dashboard",
  description: "Operational dashboard for guarded AI agents on Solana.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
