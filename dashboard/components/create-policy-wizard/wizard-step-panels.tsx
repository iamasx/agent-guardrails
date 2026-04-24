"use client";

import { useEffect, useState } from "react";
import { PROGRAM_LABELS } from "@/lib/mock/policies";
import { isValidPubkeyString } from "@/lib/create-policy/validate";
import { useCreatePolicyWizardStore } from "@/lib/stores/create-policy-wizard";

function shortenPubkey(pubkey: string): string {
  if (pubkey.length <= 8) return pubkey;
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}

function useBufferedNumberInput(
  value: number,
  setValue: (nextValue: number) => void,
  parse: (raw: string) => number,
) {
  const [inputValue, setInputValue] = useState(() => (Number.isFinite(value) ? String(value) : ""));

  useEffect(() => {
    setInputValue(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  const commitValue = () => {
    const trimmed = inputValue.trim();
    const parsedValue = trimmed ? parse(trimmed) : 0;
    setValue(Number.isFinite(parsedValue) ? parsedValue : 0);
  };

  return { inputValue, setInputValue, commitValue };
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
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                selected
                  ? "border-blue-600 bg-blue-950/40 text-blue-200"
                  : "border-zinc-700 text-zinc-300 hover:border-blue-800/60 hover:bg-blue-950/30"
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
            className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
            value={input}
            placeholder="Pubkey…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())}
          />
        </label>
        <button
          type="button"
          className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-200 transition-all duration-200 hover:border-blue-700/70 hover:bg-blue-950/30 hover:text-blue-100"
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
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-zinc-200" title={pubkey}>
                  {PROGRAM_LABELS[pubkey] ?? shortenPubkey(pubkey)}
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-red-400 transition-colors duration-150 hover:text-red-300"
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
  const maxTxInput = useBufferedNumberInput(maxTxSol, setMaxTxSol, Number.parseFloat);
  const dailyBudgetInput = useBufferedNumberInput(
    dailyBudgetSol,
    setDailyBudgetSol,
    Number.parseFloat,
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">Set spend limits in SOL (converted to lamports on-chain in a later step).</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Max per transaction (SOL)
          <input
            type="number"
            min={0}
            step="any"
            className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
            value={maxTxInput.inputValue}
            onBlur={maxTxInput.commitValue}
            onChange={(e) => maxTxInput.setInputValue(e.target.value)}
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
            value={dailyBudgetInput.inputValue}
            onBlur={dailyBudgetInput.commitValue}
            onChange={(e) => dailyBudgetInput.setInputValue(e.target.value)}
          />
          {fieldErrors.dailyBudgetSol ? <span className="text-red-400">{fieldErrors.dailyBudgetSol}</span> : null}
        </label>
      </div>
      <div className="rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
        At most {maxTxSol || 0} SOL per tx, up to {dailyBudgetSol || 0} SOL rolling 24h.
      </div>
    </div>
  );
}

function SessionStep({ fieldErrors }: { fieldErrors: Record<string, string> }) {
  const sessionDays = useCreatePolicyWizardStore((s) => s.sessionDays);
  const setSessionDays = useCreatePolicyWizardStore((s) => s.setSessionDays);
  const sessionDaysInput = useBufferedNumberInput(
    sessionDays,
    setSessionDays,
    (raw) => Number.parseInt(raw, 10),
  );

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
          className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
          value={sessionDaysInput.inputValue}
          onBlur={sessionDaysInput.commitValue}
          onChange={(e) => sessionDaysInput.setInputValue(e.target.value)}
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
  const escalationThresholdInput = useBufferedNumberInput(
    escalationThresholdSol,
    setEscalationThresholdSol,
    Number.parseFloat,
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">
        Optionally require a Squads multisig for transactions above a threshold.
      </p>
      <label className="flex items-center gap-2 text-sm text-zinc-200">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-blue-500 focus:ring-blue-500/50"
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
              className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
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
              className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-blue-700/60 focus:ring-1 focus:ring-blue-500/30"
              value={escalationThresholdInput.inputValue}
              onBlur={escalationThresholdInput.commitValue}
              onChange={(e) => escalationThresholdInput.setInputValue(e.target.value)}
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
