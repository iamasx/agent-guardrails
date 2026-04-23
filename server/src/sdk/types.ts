// types.ts — TypeScript types derived from the Guardrails program IDL.
// Source of truth — synced to server/src/sdk/ and dashboard/lib/sdk/.

import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// PDA seed constants
// ---------------------------------------------------------------------------

export const POLICY_SEED = "policy";
export const TRACKER_SEED = "tracker";

// ---------------------------------------------------------------------------
// Account types (match on-chain Anchor account structs)
// ---------------------------------------------------------------------------

/** PermissionPolicy PDA — seeds: ["policy", owner, agent] */
export interface PermissionPolicy {
  owner: PublicKey;
  agent: PublicKey;
  allowedPrograms: PublicKey[];
  maxTxLamports: BN;
  maxTxTokenUnits: BN;
  dailyBudgetLamports: BN;
  dailySpentLamports: BN;
  lastResetTs: BN;
  sessionExpiry: BN;
  isActive: boolean;
  pausedBy: PublicKey | null;
  pausedReason: number[];
  squadsMultisig: PublicKey | null;
  escalationThreshold: BN;
  authorizedMonitors: PublicKey[];
  anomalyScore: number;
  bump: number;
}

/** SpendTracker PDA — seeds: ["tracker", policy] */
export interface SpendTracker {
  policy: PublicKey;
  windowStart: BN;
  txnCount24H: number;
  lamportsSpent24H: BN;
  lastTxnTs: BN;
  lastTxnProgram: PublicKey;
  bump: number;
}

// ---------------------------------------------------------------------------
// Instruction arg types
// ---------------------------------------------------------------------------

export interface InitializePolicyArgs {
  allowedPrograms: PublicKey[];
  maxTxLamports: BN;
  maxTxTokenUnits: BN;
  dailyBudgetLamports: BN;
  sessionExpiry: BN;
  squadsMultisig: PublicKey | null;
  escalationThreshold: BN;
  authorizedMonitors: PublicKey[];
}

export interface UpdatePolicyArgs {
  allowedPrograms: PublicKey[] | null;
  maxTxLamports: BN | null;
  maxTxTokenUnits: BN | null;
  dailyBudgetLamports: BN | null;
  sessionExpiry: BN | null;
  squadsMultisig: PublicKey | null;
  escalationThreshold: BN | null;
  authorizedMonitors: PublicKey[] | null;
  anomalyScore: number | null;
}

export interface GuardedExecuteArgs {
  instructionData: Buffer;
  amountHint: BN;
}

export interface PauseAgentArgs {
  reason: Buffer | number[];
}

// ---------------------------------------------------------------------------
// Event types (emitted via emit!() in on-chain handlers)
// ---------------------------------------------------------------------------

export interface GuardedTxnExecutedEvent {
  policy: PublicKey;
  agent: PublicKey;
  targetProgram: PublicKey;
  amount: BN;
  timestamp: BN;
  txnSig: string;
}

export interface GuardedTxnRejectedEvent {
  policy: PublicKey;
  agent: PublicKey;
  reason: number;
  timestamp: BN;
}

export interface GuardedTxnAttemptedEvent {
  policy: PublicKey;
  agent: PublicKey;
  targetProgram: PublicKey;
  amountHint: BN;
  timestamp: BN;
}

export interface AgentPausedEvent {
  policy: PublicKey;
  pausedBy: PublicKey;
  reason: number[];
  timestamp: BN;
}

export interface AgentResumedEvent {
  policy: PublicKey;
  resumedBy: PublicKey;
  timestamp: BN;
}

export interface EscalatedToSquadsEvent {
  policy: PublicKey;
  squadsProposal: PublicKey;
  amount: BN;
}

// ---------------------------------------------------------------------------
// Rejection reason codes (GuardedTxnRejected.reason field)
// ---------------------------------------------------------------------------

export enum RejectionReason {
  PolicyPaused = 0,
  SessionExpired = 1,
  ProgramNotWhitelisted = 2,
  AmountExceedsLimit = 3,
  DailyBudgetExceeded = 4,
  CpiFailure = 5,
}

// ---------------------------------------------------------------------------
// Program error codes (Anchor error_code enum, starting at 6000)
// ---------------------------------------------------------------------------

export enum GuardrailsErrorCode {
  PolicyPaused = 6000,
  SessionExpired = 6001,
  ProgramNotWhitelisted = 6002,
  AmountExceedsLimit = 6003,
  DailyBudgetExceeded = 6004,
  UnauthorizedPauser = 6005,
  ResumeRequiresOwner = 6006,
  EscalatedToMultisig = 6007,
  TooManyAllowedPrograms = 6008,
  TooManyMonitors = 6009,
  SessionExpiryInPast = 6010,
  TxLimitExceedsDailyBudget = 6011,
  AmountMismatch = 6012,
  CpiExecutionFailed = 6013,
  NotYetImplemented = 6014,
}
