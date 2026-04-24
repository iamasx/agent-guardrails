"use client";

import { useEffect, useState } from "react";
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
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
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

  useEffect(() => {
    if (policyQuery.data) {
      setDraft(policySummaryToDraft(policyQuery.data));
    }
  }, [policyQuery.data]);

  const policy = policyQuery.data;
  const isOwner = Boolean(publicKey && policy && publicKey.toBase58() === policy.owner);
  const walletReady = Boolean(publicKey && provider && programId);

  if (policyQuery.isLoading) {
    return <div className="empty">Loading policy…</div>;
  }

  if (policyQuery.isError || !policy) {
    return (
      <div className="empty">
        Unable to load policy:{" "}
        {policyQuery.error ? getErrorMessage(policyQuery.error) : "Unknown error"}
      </div>
    );
  }

  if (!draft) {
    return <div className="empty">Preparing form…</div>;
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
      await client.updatePolicy(new PublicKey(policyPubkey), args);
      const chain = await client.fetchPolicy(new PublicKey(policyPubkey));
      if (!chain) throw new Error("Could not read policy after update.");
      const summary = permissionPolicyToSummary(policyPubkey, chain);

      queryClient.setQueryData(queryKeys.policy(policyPubkey), summary);
      queryClient.setQueryData(queryKeys.policies(), (old: PolicySummary[] | undefined) => {
        if (!old?.length) return [summary];
        return old.map((row) => (row.pubkey === policyPubkey ? summary : row));
      });

      setDraft(policySummaryToDraft(summary));
      setSaveBanner("Policy updated on-chain. Cache refreshed.");
    } catch (e) {
      setSaveError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {saveBanner ? (
        <div className="rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {saveBanner}
        </div>
      ) : null}
      {saveError ? (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {saveError}
        </div>
      ) : null}

      {!isOwner ? (
        <p className="text-sm text-zinc-500">
          Connect the owner wallet ({shortenPubkey(policy.owner)}) to edit this policy.
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-200">Allowed programs</h2>
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
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  selected
                    ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
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
            className="min-w-[200px] flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
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
            className="rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
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
              className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
            >
              <span className="font-mono text-zinc-200" title={pk}>
                {PROGRAM_LABELS[pk] ?? shortenPubkey(pk)}
              </span>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                disabled={!isOwner}
                onClick={() => removeProgram(pk)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Max per transaction (SOL)
          <input
            type="number"
            min={0}
            step="any"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
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
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            disabled={!isOwner}
            value={Number.isFinite(draft.dailyBudgetSol) ? draft.dailyBudgetSol : ""}
            onChange={(e) => updateDraft({ dailyBudgetSol: Number.parseFloat(e.target.value) || 0 })}
          />
          {fieldErrors.dailyBudgetSol ? (
            <span className="text-red-400">{fieldErrors.dailyBudgetSol}</span>
          ) : null}
        </label>
      </section>

      <section>
        <label className="flex max-w-xs flex-col gap-1 text-sm text-zinc-400">
          Session length (days from now, 1–90)
          <input
            type="number"
            min={1}
            max={90}
            step={1}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            disabled={!isOwner}
            value={Number.isFinite(draft.sessionDays) ? draft.sessionDays : ""}
            onChange={(e) => updateDraft({ sessionDays: Number.parseInt(e.target.value, 10) || 0 })}
          />
          {fieldErrors.sessionDays ? (
            <span className="text-red-400">{fieldErrors.sessionDays}</span>
          ) : null}
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            className="rounded border-zinc-600"
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
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
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
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
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

      <button
        type="button"
        className="w-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!isOwner || !walletReady || saving}
        onClick={() => void onSave()}
      >
        {saving ? "Saving…" : "Save on-chain"}
      </button>
    </div>
  );
}
