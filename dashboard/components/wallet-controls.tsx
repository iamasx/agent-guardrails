"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSiwsAuthStore } from "@/lib/stores/siws-auth";
import { shortAddress } from "@/lib/utils";

export function WalletControls() {
  const router = useRouter();
  const pathname = usePathname();
  const walletAdapter = useWallet();
  const { setVisible } = useWalletModal();
  const siwsWallet = useSiwsAuthStore((s) => s.siwsWallet);
  const siwsSignedInAt = useSiwsAuthStore((s) => s.siwsSignedInAt);
  const [connectError, setConnectError] = useState<string | null>(null);
  const isSigninPage = pathname === "/signin";
  let connectedWalletPubkey: string | null = null;
  let wallet = "Not connected";
  let connected = false;
  try {
    connected = Boolean(walletAdapter.connected);
    if (walletAdapter.publicKey) {
      connectedWalletPubkey = walletAdapter.publicKey.toBase58();
      wallet = shortAddress(connectedWalletPubkey, 4, 4);
    }
  } catch {
    // Graceful fallback when WalletProvider is not mounted (e.g. certain tests).
  }

  const siwsMatchesConnectedWallet =
    Boolean(connectedWalletPubkey) && Boolean(siwsWallet) && connectedWalletPubkey === siwsWallet;
  const isSiwsSignedIn = Boolean(siwsSignedInAt) && siwsMatchesConnectedWallet;
  const signedInLabel = siwsWallet ? shortAddress(siwsWallet, 4, 4) : wallet;

  useEffect(() => {
    if (!connectError) return;
    const timeout = window.setTimeout(() => setConnectError(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [connectError]);

  return (
    <div className="min-w-0 flex items-center gap-2">
      <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
        Monitor online
      </span>
      {connected ? (
        <>
          <span className="inline-flex items-center rounded-full border border-zinc-800/60 bg-zinc-900/50 px-4 py-2 text-xs font-medium text-zinc-300">
            {wallet}
          </span>
          {isSiwsSignedIn ? (
            <span className="inline-flex items-center rounded-full border border-emerald-800/60 bg-emerald-950/30 px-4 py-2 text-xs font-semibold text-emerald-200">
              Signed in as {signedInLabel}
            </span>
          ) : null}
          {!isSigninPage && !isSiwsSignedIn ? (
            <Link
              href="/signin"
              className="inline-flex items-center rounded-full border border-blue-800/60 bg-blue-950/35 px-4 py-2 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-900/40"
            >
              Connect wallet + Sign in
            </Link>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-blue-800/60 bg-blue-950/35 px-4 py-2 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-900/40"
          onClick={() => {
            if (!walletAdapter.wallet) {
              setVisible(true);
              return;
            }
            void walletAdapter
              .connect()
              .then(() => {
                if (pathname !== "/signin") {
                  router.push("/signin");
                }
              })
              .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : "Unable to connect wallet.";
                // Skip noisy toasts for explicit user cancellation.
                if (/rejected|declined|cancelled|canceled/i.test(message)) {
                  return;
                }
                setConnectError(message);
              });
          }}
        >
          Connect wallet
        </button>
      )}
      {connectError ? (
        <span className="inline-flex items-center rounded-full border border-red-900/60 bg-red-950/35 px-3 py-1.5 text-xs font-medium text-red-200">
          {connectError}
        </span>
      ) : null}
    </div>
  );
}
