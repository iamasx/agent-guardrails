"use client";

import { useCallback, useState } from "react";
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
        await client.initializePolicy(agent.publicKey, args);
        const [policyPda] = client.findPolicyPda(publicKey, agent.publicKey);
        const pdaStr = policyPda.toBase58();
        const chain = await client.fetchPolicy(policyPda);
        if (!chain) {
          throw new Error("Policy account not found immediately after creation.");
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
        setSubmitError(getErrorMessage(e));
      } finally {
        setSubmitting(false);
      }
    },
    [provider, publicKey, programId, queryClient, resetWizard, router],
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
      setSubmitError("Connect your wallet to create a policy.");
      return;
    }
    if (!provider || !programId) {
      setSubmitError("Wallet not ready or NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID is missing.");
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
    <div className="flex flex-col gap-6">
      {agentKeypair ? (
        <AgentSecretBackupModal
          agentKeypair={agentKeypair}
          busy={submitting}
          onCancel={onModalCancel}
          onConfirm={onModalConfirm}
        />
      ) : null}

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

      {submitError ? (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {submitError}
        </div>
      ) : null}

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
            <button
              type="button"
              disabled={!walletReady || submitting}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
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
