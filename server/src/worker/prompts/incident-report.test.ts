import { describe, it, expect } from "vitest";
import { REPORT_SYSTEM, buildReportUserMessage } from "./incident-report.js";

// ---------------------------------------------------------------------------
// Helpers — build inline objects matching the Prisma shapes with relations
// ---------------------------------------------------------------------------

function makeVerdict(overrides?: Record<string, unknown>) {
  return {
    id: "verdict-001",
    txnId: "txn-001",
    policyPubkey: "PolicyPda1111111111111111111111111",
    verdict: "pause",
    confidence: 92,
    reasoning: "Draining sequence detected — rapid escalation to new program",
    model: "claude-haiku-4-5",
    latencyMs: 180,
    prefilterSkipped: false,
    promptTokens: 350,
    completionTokens: 120,
    createdAt: new Date("2025-06-15T14:05:00Z"),
    ...overrides,
  };
}

function makeIncident(overrides?: Record<string, unknown>) {
  return {
    id: "incident-abc-123",
    policyPubkey: "PolicyPda1111111111111111111111111",
    pausedAt: new Date("2025-06-15T14:10:00Z"),
    pausedBy: "MonitorPubkey1111111111111111111111",
    reason: "Anomalous burst detected with high-value drain",
    triggeringTxnSig: "5xTriggerSig11111111111111111111111111111111111",
    judgeVerdictId: "verdict-001",
    fullReport: null,
    resolvedAt: null,
    resolution: null,
    createdAt: new Date("2025-06-15T14:10:00Z"),
    judgeVerdict: makeVerdict(),
    ...overrides,
  };
}

function makeTxnWithVerdict(overrides?: Record<string, unknown>) {
  return {
    id: "txn-001",
    policyPubkey: "PolicyPda1111111111111111111111111",
    txnSig: "sig-" + Math.random().toString(36).slice(2, 10),
    slot: BigInt(300000),
    blockTime: new Date("2025-06-15T14:00:00Z"),
    targetProgram: "TargetProgram1111111111111111111111",
    amountLamports: BigInt(500_000_000), // 0.5 SOL
    status: "executed",
    rejectReason: null,
    rawEvent: null,
    createdAt: new Date("2025-06-15T14:00:00Z"),
    verdict: makeVerdict({ verdict: "allow", confidence: 80 }),
    ...overrides,
  };
}

// ===========================================================================
// buildReportUserMessage tests
// ===========================================================================

describe("buildReportUserMessage", () => {
  it("includes incident ID, policy pubkey, paused time", () => {
    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, []);

    expect(msg).toContain("Incident ID: incident-abc-123");
    expect(msg).toContain("Policy: PolicyPda1111111111111111111111111");
    expect(msg).toContain("Paused at: 2025-06-15T14:10:00.000Z");
  });

  it("includes paused by and reason", () => {
    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, []);

    expect(msg).toContain("Paused by: MonitorPubkey1111111111111111111111");
    expect(msg).toContain("Reason: Anomalous burst detected with high-value drain");
  });

  it("includes triggering txn sig or 'n/a' when null", () => {
    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, []);
    expect(msg).toContain(
      "Triggering txn: 5xTriggerSig11111111111111111111111111111111111",
    );

    const incidentNoSig = makeIncident({ triggeringTxnSig: null });
    const msgNoSig = buildReportUserMessage(incidentNoSig, []);
    expect(msgNoSig).toContain("Triggering txn: n/a");
  });

  it("formats timeline as markdown table", () => {
    const txn1 = makeTxnWithVerdict({
      blockTime: new Date("2025-06-15T14:00:30Z"),
      targetProgram: "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
      amountLamports: BigInt(1_000_000_000),
      status: "executed",
      verdict: makeVerdict({ verdict: "allow", confidence: 90 }),
    });
    const txn2 = makeTxnWithVerdict({
      blockTime: new Date("2025-06-15T14:01:15Z"),
      targetProgram: "ZYXWVUTSRQPONMLKJIHGFEDCBA654321",
      amountLamports: BigInt(2_500_000_000),
      status: "flagged",
      verdict: makeVerdict({ verdict: "flag", confidence: 65 }),
    });

    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, [txn1, txn2]);

    // Table header
    expect(msg).toContain("| Time | Status | Program | Amount | Verdict |");
    expect(msg).toContain("|------|--------|---------|--------|---------|");

    // First row: time 14:00:30, program truncated to 12 chars, 1.0 SOL
    expect(msg).toContain("| 14:00:30 | executed | ABCDEFGHIJKL");
    expect(msg).toContain("1.000000 SOL");
    expect(msg).toContain("allow (90%)");

    // Second row
    expect(msg).toContain("| 14:01:15 | flagged | ZYXWVUTSRQPO");
    expect(msg).toContain("2.500000 SOL");
    expect(msg).toContain("flag (65%)");
  });

  it("shows dash row when history is empty", () => {
    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, []);

    // Should contain the dash placeholder row
    expect(msg).toContain("| \u2014 | \u2014 | \u2014 | \u2014 | \u2014 |");
  });

  it("includes judge verdict details when present", () => {
    const incident = makeIncident({
      judgeVerdict: makeVerdict({
        verdict: "pause",
        confidence: 92,
        reasoning: "Draining sequence detected",
        model: "claude-haiku-4-5",
        latencyMs: 180,
      }),
    });
    const msg = buildReportUserMessage(incident, []);

    expect(msg).toContain("Verdict: pause (92% confidence)");
    expect(msg).toContain("Reasoning: Draining sequence detected");
    expect(msg).toContain("Model: claude-haiku-4-5");
    expect(msg).toContain("Latency: 180ms");
  });

  it("shows 'No judge verdict available' when judgeVerdict is null", () => {
    const incident = makeIncident({ judgeVerdict: null });
    const msg = buildReportUserMessage(incident, []);

    expect(msg).toContain("No judge verdict available");
  });

  it("counts flagged, paused, and prefilter-skipped transactions", () => {
    const txns = [
      makeTxnWithVerdict({ verdict: makeVerdict({ verdict: "flag", prefilterSkipped: false }) }),
      makeTxnWithVerdict({ verdict: makeVerdict({ verdict: "flag", prefilterSkipped: false }) }),
      makeTxnWithVerdict({ verdict: makeVerdict({ verdict: "pause", prefilterSkipped: false }) }),
      makeTxnWithVerdict({ verdict: makeVerdict({ verdict: "allow", prefilterSkipped: true }) }),
      makeTxnWithVerdict({ verdict: makeVerdict({ verdict: "allow", prefilterSkipped: true }) }),
      makeTxnWithVerdict({ verdict: makeVerdict({ verdict: "allow", prefilterSkipped: true }) }),
      makeTxnWithVerdict({ verdict: null }),
    ];

    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, txns);

    expect(msg).toContain("Flagged: 2");
    expect(msg).toContain("Paused: 1");
    expect(msg).toContain("Prefilter-skipped: 3");
    expect(msg).toContain("Total transactions: 7");
  });

  it("truncates program IDs to 12 chars", () => {
    const longProgram = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const txn = makeTxnWithVerdict({ targetProgram: longProgram });

    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, [txn]);

    // Should contain first 12 chars followed by the ellipsis character
    expect(msg).toContain("ABCDEFGHIJKL\u2026");
    // Should NOT contain the full program ID in the table row
    expect(msg).not.toContain(longProgram + " |");
  });

  it("formats amounts as SOL with 6 decimal places", () => {
    const txn = makeTxnWithVerdict({
      amountLamports: BigInt(123_456_789), // 0.123456789 SOL -> 0.123457 (toFixed(6))
    });

    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, [txn]);

    expect(msg).toContain("0.123457 SOL");
  });

  it("handles null amountLamports in history", () => {
    const txn = makeTxnWithVerdict({
      amountLamports: null,
    });

    const incident = makeIncident();
    const msg = buildReportUserMessage(incident, [txn]);

    // Null lamports should render as 0.000000 SOL
    expect(msg).toContain("0.000000 SOL");
  });
});
