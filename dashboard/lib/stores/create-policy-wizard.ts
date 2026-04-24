import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CreatePolicyDraftInput } from "@/lib/create-policy/validate";
import { validateStep } from "@/lib/create-policy/validate";

const DRAFT_STORAGE_KEY = "guardrails-create-policy-draft";

const defaultDraft: CreatePolicyDraftInput = {
  allowedPrograms: [],
  maxTxSol: 5,
  dailyBudgetSol: 50,
  sessionDays: 30,
  escalationEnabled: false,
  squadsMultisig: "",
  escalationThresholdSol: 0,
};

function noopStorage(): Storage {
  const memory = new Map<string, string>();
  return {
    get length() {
      return memory.size;
    },
    clear: () => memory.clear(),
    getItem: (key: string) => memory.get(key) ?? null,
    key: (i: number) => Array.from(memory.keys())[i] ?? null,
    removeItem: (key: string) => {
      memory.delete(key);
    },
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };
}

export type CreatePolicyWizardState = CreatePolicyDraftInput & {
  currentStep: number;
  fieldErrors: Record<string, string>;
  goNext: () => void;
  goBack: () => void;
  addProgram: (pubkey: string) => void;
  removeProgram: (pubkey: string) => void;
  setMaxTxSol: (value: number) => void;
  setDailyBudgetSol: (value: number) => void;
  setSessionDays: (value: number) => void;
  setEscalationEnabled: (value: boolean) => void;
  setSquadsMultisig: (value: string) => void;
  setEscalationThresholdSol: (value: number) => void;
  resetWizard: () => void;
  jumpToStep: (step: number) => void;
};

export const useCreatePolicyWizardStore = create<CreatePolicyWizardState>()(
  persist(
    (set, get) => ({
      ...defaultDraft,
      currentStep: 0,
      fieldErrors: {},

      goNext: () => {
        const state = get();
        if (state.currentStep >= 3) return;
        const { ok, errors } = validateStep(state.currentStep, state);
        if (!ok) {
          set({ fieldErrors: errors });
          return;
        }
        set({ fieldErrors: {}, currentStep: state.currentStep + 1 });
      },

      goBack: () => {
        set((s) => ({
          currentStep: Math.max(0, s.currentStep - 1),
          fieldErrors: {},
        }));
      },

      addProgram: (pubkey: string) => {
        const p = pubkey.trim();
        if (!p) return;
        set((s) => {
          if (s.allowedPrograms.includes(p)) return s;
          if (s.allowedPrograms.length >= 10) return s;
          return { allowedPrograms: [...s.allowedPrograms, p], fieldErrors: {} };
        });
      },

      removeProgram: (pubkey: string) => {
        set((s) => ({
          allowedPrograms: s.allowedPrograms.filter((x) => x !== pubkey),
          fieldErrors: {},
        }));
      },

      setMaxTxSol: (value: number) => set({ maxTxSol: value, fieldErrors: {} }),
      setDailyBudgetSol: (value: number) => set({ dailyBudgetSol: value, fieldErrors: {} }),
      setSessionDays: (value: number) => set({ sessionDays: value, fieldErrors: {} }),
      setEscalationEnabled: (value: boolean) =>
        set((s) => {
          const next = {
            ...s,
            escalationEnabled: value,
            fieldErrors: {} as Record<string, string>,
            ...(value ? {} : { squadsMultisig: "", escalationThresholdSol: 0 }),
          };
          if (s.currentStep === 3) {
            next.fieldErrors = validateStep(3, next).errors;
          }
          return next;
        }),
      setSquadsMultisig: (value: string) =>
        set((s) => {
          const next = { ...s, squadsMultisig: value };
          if (s.currentStep === 3) {
            return { ...next, fieldErrors: validateStep(3, next).errors };
          }
          return { ...next, fieldErrors: {} };
        }),
      setEscalationThresholdSol: (value: number) =>
        set((s) => {
          const next = { ...s, escalationThresholdSol: value };
          if (s.currentStep === 3) {
            return { ...next, fieldErrors: validateStep(3, next).errors };
          }
          return { ...next, fieldErrors: {} };
        }),

      resetWizard: () =>
        set({
          ...defaultDraft,
          currentStep: 0,
          fieldErrors: {},
        }),

      jumpToStep: (step: number) =>
        set({
          currentStep: Math.max(0, Math.min(3, step)),
          fieldErrors: {},
        }),
    }),
    {
      name: DRAFT_STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage() : sessionStorage,
      ),
      partialize: (s) => ({
        allowedPrograms: s.allowedPrograms,
        maxTxSol: s.maxTxSol,
        dailyBudgetSol: s.dailyBudgetSol,
        sessionDays: s.sessionDays,
        escalationEnabled: s.escalationEnabled,
        squadsMultisig: s.squadsMultisig,
        escalationThresholdSol: s.escalationThresholdSol,
        currentStep: s.currentStep,
      }),
    },
  ),
);

export const WIZARD_STEP_LABELS = ["Programs", "Limits", "Session", "Escalation"] as const;
