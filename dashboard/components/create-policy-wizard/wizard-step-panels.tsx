"use client";

import { useState } from "react";
import { PROGRAM_LABELS } from "@/lib/mock/policies";
import { isValidPubkeyString } from "@/lib/create-policy/validate";
import { useCreatePolicyWizardStore } from "@/lib/stores/create-policy-wizard";

function shortenPubkey(pubkey: string): string {
  if (pubkey.length <= 8) return pubkey;
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}

export function WizardStepPanels() {
  const currentStep = useCreatePolicyWizardStore((s) => s.currentStep);
  const fieldErrors = useCreatePolicyWizardStore((s) => s.fieldErrors);

  switch (currentStep) {
    case 0:
      return <ProgramsStep fieldErrors={fieldErrors} />;
    case 1:
      return <LimitsStep fieldErrors={fieldErrors} />;
    case 2:
      return <SessionStep fieldErrors={fieldErrors} />;
    case 3:
      return <EscalationStep fieldErrors={fieldErrors} />;
    default:
      return null;
  }
}

function ProgramsStep({ fieldErrors }: { fieldErrors: Record<string, string> }) {
  const allowedPrograms = useCreatePolicyWizardStore((s) => s.allowedPrograms);
  const addProgram = useCreatePolicyWizardStore((s) => s.addProgram);
  const removeProgram = useCreatePolicyWizardStore((s) => s.removeProgram);
  const [input, setInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const onAdd = () => {
    setPasteError(null);
    const p = input.trim();
    if (!p) return;
    if (!isValidPubkeyString(p)) {
      setPasteError("Enter a valid Solana program address.");
      return;
    }
    if (allowedPrograms.length >= 10) {
      setPasteError("Maximum 10 programs.");
      return;
    }
    if (allowedPrograms.includes(p)) {
      setPasteError("That program is already in the list.");
      return;
    }
    addProgram(p);
    setInput("");
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">
        Choose preset programs or paste custom program IDs. Up to 10 allow-listed programs.
      </p>
      {fieldErrors.allowedPrograms ? (
        <p className="text-sm text-red-400">{fieldErrors.allowedPrograms}</p>
      ) : null}
      {pasteError ? <p className="text-sm text-red-400">{pasteError}</p> : null}

      <div className="flex flex-wrap gap-2">
        {Object.entries(PROGRAM_LABELS).map(([pubkey, label]) => {
          const selected = allowedPrograms.includes(pubkey);
          return (
            <button
              key={pubkey}
              type="button"
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                selected
                  ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }`}
              disabled={!selected && allowedPrograms.length >= 10}
              onClick={() => {
                if (selected) removeProgram(pubkey);
                else addProgram(pubkey);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm text-zinc-400">
          Custom program address
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={input}
            placeholder="Pubkey…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())}
          />
        </label>
        <button
          type="button"
          className="rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          onClick={onAdd}
        >
          Add
        </button>
      </div>

      <div>
        <div className="mb-2 text-sm text-zinc-500">
          Allow list ({allowedPrograms.length} / 10)
        </div>
        {allowedPrograms.length === 0 ? (
          <p className="text-sm text-zinc-500">No programs added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {allowedPrograms.map((pubkey) => (
              <li
                key={pubkey}
                className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-zinc-200" title={pubkey}>
                  {PROGRAM_LABELS[pubkey] ?? shortenPubkey(pubkey)}
                </span>
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => removeProgram(pubkey)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LimitsStep({ fieldErrors }: { fieldErrors: Record<string, string> }) {
  const maxTxSol = useCreatePolicyWizardStore((s) => s.maxTxSol);
  const dailyBudgetSol = useCreatePolicyWizardStore((s) => s.dailyBudgetSol);
  const setMaxTxSol = useCreatePolicyWizardStore((s) => s.setMaxTxSol);
  const setDailyBudgetSol = useCreatePolicyWizardStore((s) => s.setDailyBudgetSol);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">Set spend limits in SOL (converted to lamports on-chain in a later step).</p>
      <label className="flex flex-col gap-1 text-sm text-zinc-400">
        Max per transaction (SOL)
        <input
          type="number"
          min={0}
          step="any"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          value={Number.isFinite(maxTxSol) ? maxTxSol : ""}
          onChange={(e) => setMaxTxSol(Number.parseFloat(e.target.value) || 0)}
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
          value={Number.isFinite(dailyBudgetSol) ? dailyBudgetSol : ""}
          onChange={(e) => setDailyBudgetSol(Number.parseFloat(e.target.value) || 0)}
        />
        {fieldErrors.dailyBudgetSol ? <span className="text-red-400">{fieldErrors.dailyBudgetSol}</span> : null}
      </label>
    </div>
  );
}

function SessionStep({ fieldErrors }: { fieldErrors: Record<string, string> }) {
  const sessionDays = useCreatePolicyWizardStore((s) => s.sessionDays);
  const setSessionDays = useCreatePolicyWizardStore((s) => s.setSessionDays);

  const expiryMs = Date.now() + sessionDays * 86_400_000;
  const expiryDateUtc = new Date(expiryMs);
  const dateStr = expiryDateUtc.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">How long the agent session should stay valid.</p>
      <label className="flex flex-col gap-1 text-sm text-zinc-400">
        Days from now (1–90)
        <input
          type="number"
          min={1}
          max={90}
          step={1}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          value={Number.isFinite(sessionDays) ? sessionDays : ""}
          onChange={(e) => setSessionDays(Number.parseInt(e.target.value, 10) || 0)}
        />
        {fieldErrors.sessionDays ? <span className="text-red-400">{fieldErrors.sessionDays}</span> : null}
      </label>
      <p className="text-sm text-zinc-500">
        Expires on {dateStr} (relative to now, ~{sessionDays} days).
      </p>
    </div>
  );
}

function EscalationStep({ fieldErrors }: { fieldErrors: Record<string, string> }) {
  const escalationEnabled = useCreatePolicyWizardStore((s) => s.escalationEnabled);
  const squadsMultisig = useCreatePolicyWizardStore((s) => s.squadsMultisig);
  const escalationThresholdSol = useCreatePolicyWizardStore((s) => s.escalationThresholdSol);
  const setEscalationEnabled = useCreatePolicyWizardStore((s) => s.setEscalationEnabled);
  const setSquadsMultisig = useCreatePolicyWizardStore((s) => s.setSquadsMultisig);
  const setEscalationThresholdSol = useCreatePolicyWizardStore((s) => s.setEscalationThresholdSol);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">
        Optionally require a Squads multisig for transactions above a threshold.
      </p>
      <label className="flex items-center gap-2 text-sm text-zinc-200">
        <input
          type="checkbox"
          className="rounded border-zinc-600"
          checked={escalationEnabled}
          onChange={(e) => setEscalationEnabled(e.target.checked)}
        />
        Require multisig for large transactions
      </label>

      {escalationEnabled ? (
        <>
          <label className="flex flex-col gap-1 text-sm text-zinc-400">
            Squads multisig address
            <input
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              value={squadsMultisig}
              placeholder="Multisig pubkey…"
              onChange={(e) => setSquadsMultisig(e.target.value)}
            />
            {fieldErrors.squadsMultisig ? (
              <span className="text-red-400">{fieldErrors.squadsMultisig}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-400">
            Escalation threshold (SOL)
            <input
              type="number"
              min={0}
              step="any"
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              value={Number.isFinite(escalationThresholdSol) ? escalationThresholdSol : ""}
              onChange={(e) => setEscalationThresholdSol(Number.parseFloat(e.target.value) || 0)}
            />
            {fieldErrors.escalationThresholdSol ? (
              <span className="text-red-400">{fieldErrors.escalationThresholdSol}</span>
            ) : null}
          </label>
        </>
      ) : null}
    </div>
  );
}
