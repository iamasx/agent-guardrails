"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddress } from "@/lib/utils";

export function WalletControls() {
  const walletAdapter = useWallet();
  const { setVisible } = useWalletModal();
  let wallet = "Not connected";
  let connected = false;
  try {
    connected = Boolean(walletAdapter.connected);
    if (walletAdapter.publicKey) {
      wallet = shortAddress(walletAdapter.publicKey.toBase58(), 4, 4);
    }
  } catch {
    // Graceful fallback when WalletProvider is not mounted (e.g. certain tests).
  }
  return (
    <div className="min-w-0 flex items-center gap-2">
      <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
        Monitor online
      </span>
      {connected ? (
        <span className="inline-flex items-center rounded-full border border-zinc-800/60 bg-zinc-900/50 px-4 py-2 text-xs font-medium text-zinc-300">
          {wallet}
        </span>
      ) : (
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-blue-800/60 bg-blue-950/35 px-4 py-2 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-900/40"
          onClick={() => {
            if (!walletAdapter.wallet) {
              setVisible(true);
              return;
            }
            void walletAdapter.connect().catch(() => {
              // Ignore rejected connects from cancel/close actions.
            });
          }}
        >
          Connect wallet
        </button>
      )}
    </div>
  );
}
