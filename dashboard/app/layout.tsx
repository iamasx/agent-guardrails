import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
