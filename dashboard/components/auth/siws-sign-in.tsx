"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ApiClientError,
  getErrorMessage,
  requestSiwsNonce,
  verifySiwsSignature,
} from "@/lib/api/client";
import { useSiwsAuthStore } from "@/lib/stores/siws-auth";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function SiwsSignIn() {
  const router = useRouter();
  const { publicKey, signMessage, connecting, connected } = useWallet();
  const markSignedIn = useSiwsAuthStore((s) => s.markSignedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = useCallback(async () => {
    setError(null);
    if (!publicKey || !signMessage) {
      setError("This wallet cannot sign messages. Try another wallet.");
      return;
    }

    const pubkey = publicKey.toBase58();
    setBusy(true);
    try {
      const { message } = await requestSiwsNonce(pubkey);
      const encoded = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encoded);
      const signature = uint8ArrayToBase64(signatureBytes);
      await verifySiwsSignature({ pubkey, message, signature });
      markSignedIn(pubkey, new Date().toISOString());
      router.replace("/agents");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }, [markSignedIn, publicKey, router, signMessage]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">
        Connect a wallet, then sign the one-time message from the Guardrails API to create a session.
      </p>

      <p className="rounded-md border border-blue-900/40 bg-blue-950/20 px-3 py-2 text-sm text-blue-200">
        Use the global wallet button in the top bar to connect your wallet before signing in.
      </p>

      {connected && !signMessage ? (
        <p className="text-sm text-amber-400">This wallet does not support message signing.</p>
      ) : null}

      {connected && signMessage ? (
        <button
          type="button"
          className="button button-primary w-fit disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || connecting}
          onClick={() => void onSignIn()}
        >
          {busy || connecting ? "Working…" : "Sign in with Solana"}
        </button>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
