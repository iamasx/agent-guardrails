// On-chain event types matching program events, plus SSE event payload types.
// On-chain shapes from docs/data-contracts.md section 2 (On-Chain Events).
// SSE shapes from docs/data-contracts.md section 5 (SSE Event Types).

// ---------------------------------------------------------------------------
// On-chain events (emitted by the Guardrails Solana program)
// ---------------------------------------------------------------------------

/** Emitted when a guarded transaction is successfully executed. */
export interface GuardedTxnExecutedEvent {
  policy: string;
  agent: string;
  targetProgram: string;
  amount: bigint;
  timestamp: bigint;
  txnSig: string;
}

/** Emitted when a guarded transaction is rejected by on-chain policy checks. */
export interface GuardedTxnRejectedEvent {
  policy: string;
  agent: string;
  /** 0=PolicyPaused, 1=SessionExpired, 2=ProgramNotWhitelisted, 3=AmountExceeds, 4=DailyBudgetExceeded */
  reason: number;
  timestamp: bigint;
}

/** Emitted when an agent is paused by an authorized monitor. */
export interface AgentPausedEvent {
  policy: string;
  pausedBy: string;
  reason: Uint8Array;
  timestamp: bigint;
}

/** Emitted when a transaction is escalated to a Squads multisig for approval. */
export interface EscalatedToSquadsEvent {
  policy: string;
  squadsProposal: string;
  amount: bigint;
}

// ---------------------------------------------------------------------------
// SSE event payloads (Server -> Dashboard via GET /api/events)
// ---------------------------------------------------------------------------

/** Payload for `new_transaction` SSE event. Full GuardedTxn DB row. */
export interface SSENewTransaction {
  id: string;
  policyPubkey: string;
  txnSig: string;
  slot: bigint;
  blockTime: Date;
  targetProgram: string;
  amountLamports: bigint | null;
  status: string;
  rejectReason: string | null;
  rawEvent: unknown;
  createdAt: Date;
}

/** Payload for `verdict` SSE event. Full AnomalyVerdict DB row plus signals array. */
export interface SSEVerdict {
  id: string;
  txnId: string;
  policyPubkey: string;
  verdict: string;
  confidence: number;
  reasoning: string;
  model: string;
  latencyMs: number | null;
  prefilterSkipped: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: Date;
  signals: string[];
}

/** Payload for `agent_paused` SSE event. Full Incident DB row. */
export interface SSEAgentPaused {
  id: string;
  policyPubkey: string;
  pausedAt: Date;
  pausedBy: string;
  reason: string;
  triggeringTxnSig: string | null;
  judgeVerdictId: string | null;
  fullReport: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
}

/** Payload for `report_ready` SSE event. Incident ID + completed Opus postmortem. */
export interface SSEReportReady {
  incidentId: string;
  policyPubkey: string;
  fullReport: string;
}
