"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddress } from "@/lib/utils";

export function LandingConnectWalletButton() {
  const walletAdapter = useWallet();
  const { setVisible } = useWalletModal();

  let connected = false;
  let wallet = "Connect wallet";

  try {
    connected = Boolean(walletAdapter.connected);
    if (walletAdapter.publicKey) {
      wallet = shortAddress(walletAdapter.publicKey.toBase58(), 4, 4);
    }
  } catch {
    // Graceful fallback when wallet providers are unavailable.
  }

  return (
    <button
      type="button"
      className={`px-4 py-2.5 ${connected ? "button button-secondary" : "button button-primary"}`}
      onClick={() => {
        if (connected) {
          return;
        }

        if (!walletAdapter.wallet) {
          setVisible(true);
          return;
        }

        void walletAdapter.connect().catch(() => {
          // Ignore user-cancelled wallet connect attempts.
        });
      }}
    >
      {connected ? `Connected ${wallet}` : "Connect wallet"}
    </button>
  );
}
