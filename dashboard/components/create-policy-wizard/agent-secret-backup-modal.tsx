"use client";

import { useState } from "react";
import type { Keypair } from "@solana/web3.js";

function secretKeyBase64(kp: Keypair): string {
  return Buffer.from(JSON.stringify(Array.from(kp.secretKey))).toString("base64");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="max-w-lg rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/95 to-zinc-900/80 p-6 shadow-2xl shadow-blue-950/30">
        <h2 className="text-lg font-semibold text-zinc-100">Save your agent secret</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This key signs <span className="font-mono text-zinc-300">guarded_execute</span> transactions.
          It cannot be recovered later. Store the base64 secret somewhere safe.
        </p>
        <textarea
          readOnly
          className="mt-4 h-24 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950/90 px-3 py-2 font-mono text-xs text-zinc-200 outline-none"
          value={secret}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-all duration-200 hover:border-blue-700/70 hover:bg-blue-950/30 hover:text-blue-100"
            onClick={() => navigator.clipboard.writeText(secret)}
          >
            Copy secret
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-blue-500 focus:ring-blue-500/50"
            checked={saved}
            disabled={busy}
            onChange={(e) => setSaved(e.target.checked)}
          />
          I have saved this secret
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-all duration-200 hover:border-blue-700/70 hover:bg-blue-950/30 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all duration-200 hover:from-blue-500 hover:to-blue-400 hover:shadow-xl hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
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
