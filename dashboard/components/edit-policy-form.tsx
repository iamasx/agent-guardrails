"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getErrorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { usePolicyQuery } from "@/lib/api/use-policy-query";
import { buildUpdatePolicyFullReplace } from "@/lib/create-policy/build-update-args";
import { permissionPolicyToSummary } from "@/lib/create-policy/map-permission-policy";
import { policySummaryToDraft } from "@/lib/create-policy/policy-to-draft";
import {
  isValidPubkeyString,
  validateFullDraft,
  type CreatePolicyDraftInput,
} from "@/lib/create-policy/validate";
import { PROGRAM_LABELS } from "@/lib/mock/policies";
import { GuardrailsClient } from "@/lib/sdk/client";
import { getProgramId, useAnchorProvider } from "@/components/providers";
import type { PolicySummary } from "@/lib/types/dashboard";

function shortenPubkey(pubkey: string): string {
  if (pubkey.length <= 8) return pubkey;
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
}

async function fetchPolicyWithRetry(
  client: GuardrailsClient,
  policyPubkey: PublicKey,
): Promise<Awaited<ReturnType<GuardrailsClient["fetchPolicy"]>>> {
  const delaysMs = [0, 250, 500, 1000];
  let lastResult: Awaited<ReturnType<GuardrailsClient["fetchPolicy"]>> = null;

  for (const delayMs of delaysMs) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    lastResult = await client.fetchPolicy(policyPubkey);
    if (lastResult) return lastResult;
  }

  return lastResult;
}

export function EditPolicyForm({ policyPubkey }: { policyPubkey: string }) {
  const { publicKey } = useWallet();
  const provider = useAnchorProvider();
  const programId = getProgramId();
  const queryClient = useQueryClient();
  const policyQuery = usePolicyQuery(policyPubkey);

  const [draft, setDraft] = useState<CreatePolicyDraftInput | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [programInput, setProgramInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [toastError, setToastError] = useState<{ id: number; message: string } | null>(null);
  const initializedDraftForPubkeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!toastError) return;
    const timeout = window.setTimeout(() => setToastError(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toastError]);

  useEffect(() => {
    if (policyQuery.data && initializedDraftForPubkeyRef.current !== policyPubkey) {
      setDraft(policySummaryToDraft(policyQuery.data));
      initializedDraftForPubkeyRef.current = policyPubkey;
    }
  }, [policyPubkey, policyQuery.data]);

  const policy = policyQuery.data;
  const isOwner = Boolean(publicKey && policy && publicKey.toBase58() === policy.owner);
  const walletReady = Boolean(publicKey && provider && programId);

  if (policyQuery.isLoading) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
        Loading policy…
      </div>
    );
  }

  if (policyQuery.isError || !policy) {
    return (
      <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
        Unable to load policy:{" "}
        {policyQuery.error ? getErrorMessage(policyQuery.error) : "Unknown error"}
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
        Preparing form…
      </div>
    );
  }

  const updateDraft = (partial: Partial<CreatePolicyDraftInput>) => {
    setDraft((d) => (d ? { ...d, ...partial } : d));
    setFieldErrors({});
    setSaveBanner(null);
  };

  const addProgram = (pubkey: string) => {
    const p = pubkey.trim();
    if (!p || !isValidPubkeyString(p)) return;
    if (draft.allowedPrograms.includes(p) || draft.allowedPrograms.length >= 10) return;
    updateDraft({ allowedPrograms: [...draft.allowedPrograms, p] });
  };

  const removeProgram = (pubkey: string) => {
    updateDraft({ allowedPrograms: draft.allowedPrograms.filter((x) => x !== pubkey) });
  };

  const onSave = async () => {
    setSaveError(null);
    setSaveBanner(null);
    const { ok, errors } = validateFullDraft(draft);
    if (!ok) {
      setFieldErrors(errors);
      return;
    }
    if (!isOwner || !provider || !programId) {
      setSaveError("Connect the owner wallet to save changes.");
      return;
    }

    const args = buildUpdatePolicyFullReplace(draft);
    const client = new GuardrailsClient(provider, programId);
    setSaving(true);
    try {
      const policyKey = new PublicKey(policyPubkey);
      await client.updatePolicy(policyKey, args);
      const chain = await fetchPolicyWithRetry(client, policyKey);
      if (!chain) throw new Error("Could not read policy after update.");
      const summary = permissionPolicyToSummary(policyPubkey, chain, {
        createdAt: policy.createdAt,
      });

      queryClient.setQueryData(queryKeys.policy(policyPubkey), summary);
      queryClient.setQueryData(queryKeys.policies(), (old: PolicySummary[] | undefined) => {
        if (!old?.length) return [summary];
        let found = false;
        const next = old.map((row) => {
          if (row.pubkey !== policyPubkey) return row;
          found = true;
          return summary;
        });
        return found ? next : [summary, ...next];
      });

      setDraft(policySummaryToDraft(summary));
      setSaveBanner("Policy updated on-chain. Cache refreshed.");
    } catch (e) {
      const message = getErrorMessage(e);
      setSaveError(message);
      setToastError({ id: Date.now(), message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {toastError ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 max-w-sm rounded-md border border-red-900/60 bg-red-950/95 px-4 py-3 text-sm text-red-200 shadow-lg"
        >
          {toastError.message}
        </div>
      ) : null}
      {saveBanner ? (
        <div className="rounded-md border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-sm text-blue-200">
          {saveBanner}
        </div>
      ) : null}
      {saveError ? (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {saveError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-blue-950/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-5 shadow-lg shadow-blue-950/20 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-100">Policy configuration</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Fine-tune spend controls, program allow-list, and escalation safeguards for this policy.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-300">
            {isOwner ? "Owner wallet connected" : `Owner required: ${shortenPubkey(policy.owner)}`}
          </div>
        </div>
        {!isOwner ? (
          <p className="mt-3 text-sm text-amber-300/90">
            Connect the owner wallet ({shortenPubkey(policy.owner)}) to edit this policy.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">Allowed programs</h2>
          <span className="inline-flex items-center rounded-full border border-blue-900/40 bg-blue-950/30 px-3 py-1 text-xs font-medium text-blue-200">
            {draft.allowedPrograms.length} / 10 selected
          </span>
        </div>
        {fieldErrors.allowedPrograms ? (
          <p className="text-sm text-red-400">{fieldErrors.allowedPrograms}</p>
        ) : null}
        {pasteError ? <p className="text-sm text-red-400">{pasteError}</p> : null}
        <div className="flex flex-wrap gap-2">
          {Object.entries(PROGRAM_LABELS).map(([pk, label]) => {
            const selected = draft.allowedPrograms.includes(pk);
            return (
              <button
                key={pk}
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  selected
                    ? "border-blue-600 bg-blue-950/40 text-blue-200 shadow-sm shadow-blue-900/30"
                    : "border-zinc-700 text-zinc-300 hover:border-blue-700/60 hover:bg-blue-950/30"
                }`}
                disabled={!isOwner || (!selected && draft.allowedPrograms.length >= 10)}
                onClick={() => {
                  if (selected) removeProgram(pk);
                  else addProgram(pk);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
            value={programInput}
            placeholder="Custom program pubkey…"
            disabled={!isOwner}
            onChange={(e) => setProgramInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              setPasteError(null);
              const p = programInput.trim();
              if (!isValidPubkeyString(p)) {
                setPasteError("Invalid program address.");
                return;
              }
              if (draft.allowedPrograms.length >= 10) {
                setPasteError("Maximum 10 programs.");
                return;
              }
              addProgram(p);
              setProgramInput("");
            }}
          />
          <button
            type="button"
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-200 transition-all duration-200 hover:border-blue-700/70 hover:bg-blue-950/30 hover:text-blue-100 disabled:opacity-50"
            disabled={!isOwner}
            onClick={() => {
              setPasteError(null);
              const p = programInput.trim();
              if (!isValidPubkeyString(p)) {
                setPasteError("Invalid program address.");
                return;
              }
              if (draft.allowedPrograms.length >= 10) {
                setPasteError("Maximum 10 programs.");
                return;
              }
              addProgram(p);
              setProgramInput("");
            }}
          >
            Add
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {draft.allowedPrograms.map((pk) => (
            <li
              key={pk}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
            >
              <span className="font-mono text-zinc-200" title={pk}>
                {PROGRAM_LABELS[pk] ?? shortenPubkey(pk)}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-red-400 transition-colors duration-150 hover:text-red-300 disabled:opacity-50"
                disabled={!isOwner}
                onClick={() => removeProgram(pk)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-5 backdrop-blur-sm md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Max per transaction (SOL)
          <input
            type="number"
            min={0}
            step="any"
            className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
            disabled={!isOwner}
            value={Number.isFinite(draft.maxTxSol) ? draft.maxTxSol : ""}
            onChange={(e) => updateDraft({ maxTxSol: Number.parseFloat(e.target.value) || 0 })}
          />
          {fieldErrors.maxTxSol ? <span className="text-red-400">{fieldErrors.maxTxSol}</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Daily budget (SOL)
          <input
            type="number"
            min={0}
            step="any"
            className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
            disabled={!isOwner}
            value={Number.isFinite(draft.dailyBudgetSol) ? draft.dailyBudgetSol : ""}
            onChange={(e) => updateDraft({ dailyBudgetSol: Number.parseFloat(e.target.value) || 0 })}
          />
          {fieldErrors.dailyBudgetSol ? (
            <span className="text-red-400">{fieldErrors.dailyBudgetSol}</span>
          ) : null}
        </label>
      </section>

      <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-5 backdrop-blur-sm">
        <label className="flex max-w-xs flex-col gap-1 text-sm text-zinc-400">
          Session length (days from now, 1–90)
          <input
            type="number"
            min={1}
            max={90}
            step={1}
            className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
            disabled={!isOwner}
            value={Number.isFinite(draft.sessionDays) ? draft.sessionDays : ""}
            onChange={(e) => updateDraft({ sessionDays: Number.parseInt(e.target.value, 10) || 0 })}
          />
          {fieldErrors.sessionDays ? (
            <span className="text-red-400">{fieldErrors.sessionDays}</span>
          ) : null}
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/35 p-5 backdrop-blur-sm">
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-blue-500 focus:ring-blue-500/50"
            disabled={!isOwner}
            checked={draft.escalationEnabled}
            onChange={(e) =>
              updateDraft({
                escalationEnabled: e.target.checked,
                ...(e.target.checked ? {} : { squadsMultisig: "", escalationThresholdSol: 0 }),
              })
            }
          />
          Require multisig for large transactions
        </label>
        {draft.escalationEnabled ? (
          <>
            <label className="flex flex-col gap-1 text-sm text-zinc-400">
              Squads multisig address
              <input
                className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
                disabled={!isOwner}
                value={draft.squadsMultisig}
                onChange={(e) => updateDraft({ squadsMultisig: e.target.value })}
              />
              {fieldErrors.squadsMultisig ? (
                <span className="text-red-400">{fieldErrors.squadsMultisig}</span>
              ) : null}
            </label>
            <label className="flex max-w-xs flex-col gap-1 text-sm text-zinc-400">
              Escalation threshold (SOL)
              <input
                type="number"
                min={0}
                step="any"
                className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
                disabled={!isOwner}
                value={Number.isFinite(draft.escalationThresholdSol) ? draft.escalationThresholdSol : ""}
                onChange={(e) =>
                  updateDraft({ escalationThresholdSol: Number.parseFloat(e.target.value) || 0 })
                }
              />
              {fieldErrors.escalationThresholdSol ? (
                <span className="text-red-400">{fieldErrors.escalationThresholdSol}</span>
              ) : null}
            </label>
          </>
        ) : null}
      </section>

      <p className="text-xs text-zinc-500">
        Authorized monitor pubkeys are taken from{" "}
        <span className="font-mono">NEXT_PUBLIC_MONITOR_PUBKEY</span> (comma-separated, max 3) when you
        save, matching policy creation.
      </p>

      <div className="sticky bottom-3 z-20 flex justify-end">
        <button
          type="button"
          className="button button-primary w-fit px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isOwner || !walletReady || saving}
          onClick={() => void onSave()}
        >
          {saving ? "Saving…" : "Save on-chain"}
        </button>
      </div>
    </div>
  );
}
