import { randomUUID } from "node:crypto";

export function makePolicy(overrides?: Record<string, unknown>) {
  return {
    pubkey: "PolicyPda1111111111111111111111111",
    owner: "OwnerPubkey11111111111111111111111",
    agent: "AgentPubkey11111111111111111111111",
    allowedPrograms: ["TargetProgram1111111111111111111111", "11111111111111111111111111111111"],
    maxTxLamports: BigInt(1_000_000_000), // 1 SOL
    dailyBudgetLamports: BigInt(10_000_000_000), // 10 SOL
    sessionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    isActive: true,
    squadsMultisig: null,
    escalationThreshold: null,
    anomalyScore: 0,
    label: "Test Policy",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeGuardedTxn(overrides?: Record<string, unknown>) {
  return {
    id: randomUUID(),
    policyPubkey: "PolicyPda1111111111111111111111111",
    txnSig: "txn-sig-" + Math.random().toString(36).slice(2, 10),
    slot: BigInt(123456),
    blockTime: new Date(),
    targetProgram: "TargetProgram1111111111111111111111",
    amountLamports: BigInt(100_000_000),
    status: "executed",
    rejectReason: null,
    rawEvent: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeAnomalyVerdict(overrides?: Record<string, unknown>) {
  return {
    id: randomUUID(),
    txnId: randomUUID(),
    policyPubkey: "PolicyPda1111111111111111111111111",
    verdict: "allow",
    confidence: 85,
    reasoning: "Routine transaction",
    model: "claude-haiku-4-5",
    latencyMs: 150,
    prefilterSkipped: false,
    promptTokens: 100,
    completionTokens: 50,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeIncident(overrides?: Record<string, unknown>) {
  return {
    id: randomUUID(),
    policyPubkey: "PolicyPda1111111111111111111111111",
    pausedAt: new Date(),
    pausedBy: "MonitorPubkey1111111111111111111111",
    reason: "Anomalous burst detected",
    triggeringTxnSig: "trigger-sig-abc123",
    judgeVerdictId: randomUUID(),
    fullReport: null,
    resolvedAt: null,
    resolution: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeAuthSession(overrides?: Record<string, unknown>) {
  return {
    id: randomUUID(),
    walletPubkey: "OwnerPubkey11111111111111111111111",
    nonce: "test-nonce-" + Math.random().toString(36).slice(2, 10),
    signedAt: null,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}
