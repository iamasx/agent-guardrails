// client.ts — GuardrailsClient class wrapping the Anchor program client.
// Source of truth — synced to server/src/sdk/ and dashboard/lib/sdk/.
//
// Usage:
//   const client = new GuardrailsClient(provider);
//   const policy = await client.fetchPolicy(policyPda);
//   await client.pauseAgent(callerKeypair, policyPda, "Anomaly detected");

import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import IDL from "./idl/guardrails.json";
import {
  POLICY_SEED,
  TRACKER_SEED,
  type PermissionPolicy,
  type SpendTracker,
  type InitializePolicyArgs,
  type UpdatePolicyArgs,
  type GuardedExecuteArgs,
} from "./types";

// ---------------------------------------------------------------------------
// Resolve program ID from env vars (server: GUARDRAILS_PROGRAM_ID,
// dashboard: NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID) or require explicit param.
// ---------------------------------------------------------------------------

function getEnvProgramId(): PublicKey | undefined {
  const envId =
    typeof process !== "undefined"
      ? process.env.GUARDRAILS_PROGRAM_ID ??
        process.env.NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID
      : undefined;
  return envId ? new PublicKey(envId) : undefined;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class GuardrailsClient {
  readonly program: Program;
  readonly programId: PublicKey;

  /**
   * @param provider - Anchor provider (wallet + connection)
   * @param programId - Program ID. If omitted, reads from GUARDRAILS_PROGRAM_ID
   *   or NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID env var.
   */
  constructor(provider: AnchorProvider, programId?: PublicKey) {
    const resolved = programId ?? getEnvProgramId();
    if (!resolved) {
      throw new Error(
        "programId required: pass explicitly or set GUARDRAILS_PROGRAM_ID / NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID env var",
      );
    }
    this.programId = resolved;

    // Override the IDL's embedded address with the resolved program ID so
    // the Anchor Program instance and PDA derivation use the same ID.
    // This avoids mismatches when deploying to different clusters.
    const idlWithAddress = { ...IDL, address: resolved.toBase58() };
    this.program = new Program(idlWithAddress as any, provider);
  }

  // -------------------------------------------------------------------------
  // PDA derivation
  // -------------------------------------------------------------------------

  /** Derives the PermissionPolicy PDA for an (owner, agent) pair. */
  findPolicyPda(owner: PublicKey, agent: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(POLICY_SEED),
        owner.toBuffer(),
        agent.toBuffer(),
      ],
      this.programId,
    );
  }

  /** Derives the SpendTracker PDA for a policy. */
  findTrackerPda(policy: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(TRACKER_SEED), policy.toBuffer()],
      this.programId,
    );
  }

  // -------------------------------------------------------------------------
  // Account fetchers
  // -------------------------------------------------------------------------

  /** Fetches a PermissionPolicy account by its PDA address. */
  async fetchPolicy(policyPda: PublicKey): Promise<PermissionPolicy | null> {
    try {
      const account = await (this.program.account as any).permissionPolicy.fetch(policyPda);
      return account as PermissionPolicy;
    } catch {
      return null;
    }
  }

  /** Fetches a SpendTracker account by its PDA address. */
  async fetchTracker(trackerPda: PublicKey): Promise<SpendTracker | null> {
    try {
      const account = await (this.program.account as any).spendTracker.fetch(trackerPda);
      return account as SpendTracker;
    } catch {
      return null;
    }
  }

  /** Derives the policy PDA from (owner, agent), then fetches it. */
  async fetchPolicyByOwnerAgent(
    owner: PublicKey,
    agent: PublicKey,
  ): Promise<PermissionPolicy | null> {
    const [pda] = this.findPolicyPda(owner, agent);
    return this.fetchPolicy(pda);
  }

  // -------------------------------------------------------------------------
  // Instruction methods
  // -------------------------------------------------------------------------

  /** Creates a PermissionPolicy + SpendTracker PDA pair. */
  async initializePolicy(
    owner: Keypair,
    agent: PublicKey,
    args: InitializePolicyArgs,
  ): Promise<string> {
    const [policyPda] = this.findPolicyPda(owner.publicKey, agent);
    const [trackerPda] = this.findTrackerPda(policyPda);

    return await (this.program.methods as any)
      .initializePolicy(args)
      .accounts({
        owner: owner.publicKey,
        agent,
        policy: policyPda,
        spendTracker: trackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();
  }

  /** Updates configurable fields on an existing policy. Owner-only. */
  async updatePolicy(
    owner: Keypair,
    policyPda: PublicKey,
    args: UpdatePolicyArgs,
  ): Promise<string> {
    return await (this.program.methods as any)
      .updatePolicy(args)
      .accounts({
        owner: owner.publicKey,
        policy: policyPda,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Executes a guarded CPI through the policy's permission layer.
   *
   * @param agent - The agent session keypair (signs the outer transaction)
   * @param policyPda - The PermissionPolicy PDA
   * @param trackerPda - The SpendTracker PDA
   * @param targetProgram - The program to CPI into
   * @param args - Instruction data + amount hint
   * @param remainingAccounts - CPI accounts (source, dest, authority, target program)
   */
  async guardedExecute(
    agent: Keypair,
    policyPda: PublicKey,
    trackerPda: PublicKey,
    targetProgram: PublicKey,
    args: GuardedExecuteArgs,
    remainingAccounts: AccountMeta[],
  ): Promise<string> {
    return await (this.program.methods as any)
      .guardedExecute(args)
      .accounts({
        agent: agent.publicKey,
        policy: policyPda,
        spendTracker: trackerPda,
        targetProgram,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .signers([agent])
      .rpc();
  }

  /** Pauses an agent. Callable by owner or authorized monitor. */
  async pauseAgent(
    caller: Keypair,
    policyPda: PublicKey,
    reason: string | Buffer,
  ): Promise<string> {
    const reasonBuf = typeof reason === "string" ? Buffer.from(reason) : reason;

    return await (this.program.methods as any)
      .pauseAgent({ reason: reasonBuf })
      .accounts({
        caller: caller.publicKey,
        policy: policyPda,
      })
      .signers([caller])
      .rpc();
  }

  /** Resumes a paused agent. Owner-only. */
  async resumeAgent(
    owner: Keypair,
    policyPda: PublicKey,
  ): Promise<string> {
    return await (this.program.methods as any)
      .resumeAgent()
      .accounts({
        owner: owner.publicKey,
        policy: policyPda,
      })
      .signers([owner])
      .rpc();
  }
}
