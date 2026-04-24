"use client";

import { useState } from "react";
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

  const isOwner = Boolean(publicKey && publicKey.toBase58() === policy.owner);
  const walletReady = Boolean(provider && programId);
  const visible = policy.isActive && isOwner;

  if (!visible) {
    return null;
  }

  const reasonBytes = new TextEncoder().encode(reason.trim());
  const reasonOk = reasonBytes.length > 0 && reasonBytes.length <= REASON_MAX;

  const onConfirm = async () => {
    if (!reasonOk || !provider || !programId) return;
    setBusy(true);
    setError(null);
    setBanner(null);
    try {
      const client = new GuardrailsClient(provider, programId);
      const trimmed = reason.trim().slice(0, REASON_MAX);
      await client.pauseAgent(new PublicKey(policy.pubkey), trimmed);

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
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      {banner ? (
        <div className="mb-3 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {banner}
        </div>
      ) : null}
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

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-medium text-zinc-100">Pause this agent?</h2>
            <p className="mt-2 text-sm text-zinc-400">
              This stops all guarded transactions immediately. Only the policy owner can resume later.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm text-zinc-400">
              Reason (required, max {REASON_MAX} characters)
              <textarea
                className="min-h-[80px] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                value={reason}
                maxLength={REASON_MAX}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you pausing?"
              />
            </label>
            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
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
