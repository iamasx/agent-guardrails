"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ApiClientError,
  getErrorMessage,
  requestSiwsNonce,
  verifySiwsSignature,
} from "@/lib/api/client";

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
  }, [publicKey, router, signMessage]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">
        Connect a wallet, then sign the one-time message from the Guardrails API to create a session.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <WalletMultiButton />
      </div>

      {connected && !signMessage ? (
        <p className="text-sm text-amber-400">This wallet does not support message signing.</p>
      ) : null}

      {connected && signMessage ? (
        <button
          type="button"
          className="inline-flex w-fit items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
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
