import { PublicKey } from "@solana/web3.js";

export function isValidPubkeyString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

export interface CreatePolicyDraftInput {
  allowedPrograms: string[];
  maxTxSol: number;
  dailyBudgetSol: number;
  sessionDays: number;
  escalationEnabled: boolean;
  squadsMultisig: string;
  escalationThresholdSol: number;
}

export function validatePrograms(programs: string[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (programs.length === 0) {
    errors.allowedPrograms = "Add at least one program.";
    return errors;
  }
  if (programs.length > 10) {
    errors.allowedPrograms = "Maximum 10 programs.";
    return errors;
  }
  for (const p of programs) {
    if (!isValidPubkeyString(p)) {
      errors.allowedPrograms = "Every program must be a valid Solana address.";
      return errors;
    }
  }
  return errors;
}

export function validateLimits(maxTxSol: number, dailyBudgetSol: number): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isFinite(maxTxSol) || maxTxSol <= 0) {
    errors.maxTxSol = "Max per transaction must be greater than 0 SOL.";
  }
  if (!Number.isFinite(dailyBudgetSol) || dailyBudgetSol <= 0) {
    errors.dailyBudgetSol = "Daily budget must be greater than 0 SOL.";
  }
  if (
    Number.isFinite(maxTxSol) &&
    Number.isFinite(dailyBudgetSol) &&
    maxTxSol > 0 &&
    dailyBudgetSol > 0 &&
    dailyBudgetSol < maxTxSol
  ) {
    errors.dailyBudgetSol = "Daily budget must be greater than or equal to max per transaction.";
  }
  return errors;
}

export function validateSession(sessionDays: number): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isFinite(sessionDays) || !Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 90) {
    errors.sessionDays = "Session length must be a whole number of days between 1 and 90.";
  }
  return errors;
}

export function validateEscalation(
  enabled: boolean,
  multisig: string,
  thresholdSol: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!enabled) return errors;
  const trimmed = multisig.trim();
  if (!trimmed) {
    errors.squadsMultisig = "Squads multisig address is required when escalation is enabled.";
  } else if (!isValidPubkeyString(trimmed)) {
    errors.squadsMultisig = "Invalid multisig address.";
  }
  if (!Number.isFinite(thresholdSol) || thresholdSol <= 0) {
    errors.escalationThresholdSol = "Escalation threshold must be greater than 0 SOL.";
  }
  return errors;
}

/** Run all step validators (for submit / edit save). */
export function validateFullDraft(draft: CreatePolicyDraftInput): {
  ok: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {
    ...validatePrograms(draft.allowedPrograms),
    ...validateLimits(draft.maxTxSol, draft.dailyBudgetSol),
    ...validateSession(draft.sessionDays),
    ...validateEscalation(
      draft.escalationEnabled,
      draft.squadsMultisig,
      draft.escalationThresholdSol,
    ),
  };
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Wizard step index for the first field error (0–3). */
export function firstErrorStepFromErrors(errors: Record<string, string>): number {
  if (errors.allowedPrograms) return 0;
  if (errors.maxTxSol || errors.dailyBudgetSol) return 1;
  if (errors.sessionDays) return 2;
  if (errors.squadsMultisig || errors.escalationThresholdSol) return 3;
  return 0;
}

export function validateStep(
  stepIndex: number,
  draft: CreatePolicyDraftInput,
): { ok: boolean; errors: Record<string, string> } {
  let errors: Record<string, string> = {};
  switch (stepIndex) {
    case 0:
      errors = validatePrograms(draft.allowedPrograms);
      break;
    case 1:
      errors = validateLimits(draft.maxTxSol, draft.dailyBudgetSol);
      break;
    case 2:
      errors = validateSession(draft.sessionDays);
      break;
    case 3:
      errors = validateEscalation(
        draft.escalationEnabled,
        draft.squadsMultisig,
        draft.escalationThresholdSol,
      );
      break;
    default:
      break;
  }
  const ok = Object.keys(errors).length === 0;
  return { ok, errors };
}
