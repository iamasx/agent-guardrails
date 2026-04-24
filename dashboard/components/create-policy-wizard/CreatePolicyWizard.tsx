"use client";

import { WizardStepPanels } from "@/components/create-policy-wizard/wizard-step-panels";
import { useCreatePolicyWizardStore, WIZARD_STEP_LABELS } from "@/lib/stores/create-policy-wizard";

export function CreatePolicyWizard() {
  const currentStep = useCreatePolicyWizardStore((s) => s.currentStep);
  const goNext = useCreatePolicyWizardStore((s) => s.goNext);
  const goBack = useCreatePolicyWizardStore((s) => s.goBack);
  const resetWizard = useCreatePolicyWizardStore((s) => s.resetWizard);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Wizard steps" className="flex flex-wrap gap-2">
        {WIZARD_STEP_LABELS.map((label, index) => {
          const active = index === currentStep;
          const done = index < currentStep;
          return (
            <div
              key={label}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                active
                  ? "border-emerald-600 bg-emerald-950/30 text-emerald-200"
                  : done
                    ? "border-zinc-700 text-zinc-400"
                    : "border-zinc-800 text-zinc-500"
              }`}
            >
              {index + 1}. {label}
            </div>
          );
        })}
      </nav>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <WizardStepPanels />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm text-zinc-500 underline decoration-zinc-600 hover:text-zinc-300"
          onClick={() => resetWizard()}
        >
          Reset draft
        </button>
        <div className="flex flex-wrap gap-2">
          {currentStep > 0 ? (
            <button
              type="button"
              className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              onClick={() => goBack()}
            >
              Back
            </button>
          ) : null}
          {currentStep < 3 ? (
            <button
              type="button"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              onClick={() => goNext()}
            >
              Next
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400"
              >
                Create policy
              </button>
              <span className="max-w-xs text-right text-xs text-zinc-500">
                On-chain submission is wired in Phase 4C.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
