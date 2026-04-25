"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { WizardStepPanels } from "@/components/create-policy-wizard/wizard-step-panels";
import { AgentSecretBackupModal } from "@/components/create-policy-wizard/agent-secret-backup-modal";
import { getErrorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { buildInitializePolicyArgs } from "@/lib/create-policy/build-args";
import { permissionPolicyToSummary } from "@/lib/create-policy/map-permission-policy";
import {
  firstErrorStepFromErrors,
  validateFullDraft,
} from "@/lib/create-policy/validate";
import { GuardrailsClient } from "@/lib/sdk/client";
import { useCreatePolicyWizardStore, WIZARD_STEP_LABELS } from "@/lib/stores/create-policy-wizard";
import { getProgramId, useAnchorProvider } from "@/components/providers";
import type { PolicySummary } from "@/lib/types/dashboard";

const POLICY_READ_RETRIES = 5;
const POLICY_READ_BASE_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isIdempotentCreateError(error: unknown) {
  const msg = getErrorMessage(error).toLowerCase();
  return msg.includes("already in use") || msg.includes("already initialized");
}

export function CreatePolicyWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const provider = useAnchorProvider();
  const programId = getProgramId();

  const currentStep = useCreatePolicyWizardStore((s) => s.currentStep);
  const goNext = useCreatePolicyWizardStore((s) => s.goNext);
  const goBack = useCreatePolicyWizardStore((s) => s.goBack);
  const resetWizard = useCreatePolicyWizardStore((s) => s.resetWizard);
  const jumpToStep = useCreatePolicyWizardStore((s) => s.jumpToStep);

  const [agentKeypair, setAgentKeypair] = useState<Keypair | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  useEffect(() => {
    if (!toastError) return;
    const timeout = window.setTimeout(() => setToastError(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toastError]);

  const publishError = useCallback((message: string) => {
    setSubmitError(message);
    setToastError(message);
  }, []);

  const runCreate = useCallback(
    async (agent: Keypair) => {
      if (!provider || !publicKey || !programId) {
        setSubmitError("Connect your wallet and set the program ID in the environment.");
        return;
      }

      const state = useCreatePolicyWizardStore.getState();
      const args = buildInitializePolicyArgs(state);
      const client = new GuardrailsClient(provider, programId);

      setSubmitting(true);
      setSubmitError(null);
      try {
        const [policyPda] = client.findPolicyPda(publicKey, agent.publicKey);
        const pdaStr = policyPda.toBase58();
        try {
          await client.initializePolicy(agent.publicKey, args);
        } catch (e) {
          // If account creation already landed, treat this as success and continue.
          if (!isIdempotentCreateError(e)) throw e;
        }

        let chain = await client.fetchPolicy(policyPda);
        for (let attempt = 0; !chain && attempt < POLICY_READ_RETRIES; attempt += 1) {
          await sleep(POLICY_READ_BASE_DELAY_MS * (attempt + 1));
          chain = await client.fetchPolicy(policyPda);
        }
        if (!chain) {
          throw new Error("Policy account was not readable after creation. Please try again.");
        }
        const summary = permissionPolicyToSummary(pdaStr, chain);

        queryClient.setQueryData(queryKeys.policy(pdaStr), summary);
        queryClient.setQueryData(queryKeys.policies(), (old: PolicySummary[] | undefined) => {
          if (!old?.length) return [summary];
          if (old.some((p) => p.pubkey === pdaStr)) {
            return old.map((p) => (p.pubkey === pdaStr ? summary : p));
          }
          return [summary, ...old];
        });

        setAgentKeypair(null);
        resetWizard();
        router.push(`/agents/${pdaStr}`);
      } catch (e) {
        publishError(getErrorMessage(e));
      } finally {
        setSubmitting(false);
      }
    },
    [programId, provider, publicKey, publishError, queryClient, resetWizard, router],
  );

  const onCreateClick = () => {
    setSubmitError(null);
    const state = useCreatePolicyWizardStore.getState();
    const { ok, errors } = validateFullDraft(state);
    if (!ok) {
      jumpToStep(firstErrorStepFromErrors(errors));
      useCreatePolicyWizardStore.setState({ fieldErrors: errors });
      return;
    }
    if (!publicKey) {
      publishError("Connect your wallet to create a policy.");
      return;
    }
    if (!provider || !programId) {
      publishError("Wallet not ready or NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID is missing.");
      return;
    }
    if (!agentKeypair) {
      setAgentKeypair(Keypair.generate());
      return;
    }
  };

  const onModalConfirm = () => {
    if (agentKeypair) void runCreate(agentKeypair);
  };

  const onModalCancel = () => {
    if (!submitting) setAgentKeypair(null);
  };

  const walletReady = Boolean(publicKey && provider && programId);
  const canSubmitStep = currentStep === 3;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {toastError ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 max-w-sm rounded-md border border-red-900/60 bg-red-950/95 px-4 py-3 text-sm text-red-200 shadow-lg"
        >
          {toastError}
        </div>
      ) : null}
      {agentKeypair ? (
        <AgentSecretBackupModal
          agentKeypair={agentKeypair}
          busy={submitting}
          onCancel={onModalCancel}
          onConfirm={onModalConfirm}
        />
      ) : null}

      <nav aria-label="Wizard steps" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {WIZARD_STEP_LABELS.map((label, index) => {
          const active = index === currentStep;
          const done = index < currentStep;
          return (
            <div
              key={label}
              className={`rounded-md border px-3 py-2 text-sm ${
                active
                  ? "border-blue-600 bg-blue-950/40 text-blue-200"
                  : done
                    ? "border-blue-900/60 text-blue-200/80"
                    : "border-zinc-800 text-zinc-500"
              }`}
            >
              {index + 1}. {label}
            </div>
          );
        })}
      </nav>

      {submitError ? (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {submitError}
        </div>
      ) : null}

      <div className="panel-glow p-5 md:p-6">
        <WizardStepPanels />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
              className="button button-secondary px-4 py-2.5 font-semibold"
              onClick={() => goBack()}
            >
              Back
            </button>
          ) : null}
          {currentStep < 3 ? (
            <button
              type="button"
              className="button button-primary px-4 py-2.5 font-semibold"
              onClick={() => goNext()}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={!walletReady || submitting}
              className="button button-primary px-4 py-2.5 font-semibold"
              onClick={onCreateClick}
            >
              {submitting ? "Creating…" : "Create policy"}
            </button>
          )}
        </div>
      </div>

      {canSubmitStep && !walletReady ? (
        <p className="text-sm text-zinc-500">Connect a wallet to submit this policy on-chain.</p>
      ) : null}
    </div>
  );
}
