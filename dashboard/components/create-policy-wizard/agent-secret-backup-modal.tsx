"use client";

import { useState } from "react";
import type { Keypair } from "@solana/web3.js";

function secretKeyBase64(kp: Keypair): string {
  return Buffer.from(kp.secretKey).toString("base64");
}

export function AgentSecretBackupModal({
  agentKeypair,
  onCancel,
  onConfirm,
  busy,
}: {
  agentKeypair: Keypair;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const secret = secretKeyBase64(agentKeypair);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        <h2 className="text-lg font-medium text-zinc-100">Save your agent secret</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This key signs <span className="font-mono text-zinc-300">guarded_execute</span> transactions.
          It cannot be recovered later. Store the base64 secret somewhere safe.
        </p>
        <textarea
          readOnly
          className="mt-4 h-24 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200"
          value={secret}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => navigator.clipboard.writeText(secret)}
          >
            Copy secret
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="rounded border-zinc-600"
            checked={saved}
            disabled={busy}
            onChange={(e) => setSaved(e.target.checked)}
          />
          I have saved this secret
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!saved || busy}
            onClick={onConfirm}
          >
            {busy ? "Signing…" : "Sign and create policy"}
          </button>
        </div>
      </div>
    </div>
  );
}
