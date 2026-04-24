"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getErrorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { GuardrailsClient } from "@/lib/sdk/client";
import { getProgramId, useAnchorProvider } from "@/components/providers";
import type { PolicySummary } from "@/lib/types/dashboard";

const REASON_MAX = 64;

export function KillSwitchButton({ policy }: { policy: PolicySummary }) {
  const { publicKey } = useWallet();
  const provider = useAnchorProvider();
  const programId = getProgramId();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  useEffect(() => {
    if (!toastError) return;
    const timeout = window.setTimeout(() => setToastError(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toastError]);

  const isOwner = Boolean(publicKey && publicKey.toBase58() === policy.owner);
  const walletReady = Boolean(provider && programId);
  const canPause = policy.isActive && isOwner;
  const visible = isOwner && (policy.isActive || Boolean(banner));

  if (!visible) {
    return null;
  }

  const trimmedReason = reason.trim();
  const reasonByteLength = new TextEncoder().encode(trimmedReason).length;
  const reasonOk = reasonByteLength > 0 && reasonByteLength <= REASON_MAX;

  const onConfirm = async () => {
    if (!reasonOk || !provider || !programId) return;
    setBusy(true);
    setError(null);
    setBanner(null);
    try {
      const client = new GuardrailsClient(provider, programId);
      await client.pauseAgent(new PublicKey(policy.pubkey), trimmedReason);

      const now = new Date().toISOString();
      queryClient.setQueryData(queryKeys.policy(policy.pubkey), (prev: PolicySummary | undefined) =>
        prev ? { ...prev, isActive: false, updatedAt: now } : prev,
      );
      queryClient.setQueryData(queryKeys.policies(), (old: PolicySummary[] | undefined) => {
        if (!old) return old;
        return old.map((row) =>
          row.pubkey === policy.pubkey ? { ...row, isActive: false, updatedAt: now } : row,
        );
      });

      setBanner("Agent paused on-chain.");
      setOpen(false);
      setReason("");
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      setToastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      {toastError ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 max-w-sm rounded-md border border-red-900/60 bg-red-950/95 px-4 py-3 text-sm text-red-200 shadow-lg"
        >
          {toastError}
        </div>
      ) : null}
      {banner ? (
        <div className="mb-3 rounded-md border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-sm text-blue-200">
          {banner}
        </div>
      ) : null}
      {canPause ? (
        <button
          type="button"
          className="rounded-md border border-red-800 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!walletReady}
          title={!walletReady ? "Connect owner wallet" : undefined}
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
        >
          Pause agent (kill switch)
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-medium text-zinc-100">Pause this agent?</h2>
            <p className="mt-2 text-sm text-zinc-400">
              This stops all guarded transactions immediately. Only the policy owner can resume later.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm text-zinc-400">
              Reason (required, max {REASON_MAX} bytes)
              <textarea
                className="min-h-[80px] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you pausing?"
              />
            </label>
            <p className={`text-xs ${reasonByteLength > REASON_MAX ? "text-red-400" : "text-zinc-500"}`}>
              {reasonByteLength}/{REASON_MAX} bytes
            </p>
            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setReason("");
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!reasonOk || busy}
                onClick={() => void onConfirm()}
              >
                {busy ? "Signing…" : "Confirm pause"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
