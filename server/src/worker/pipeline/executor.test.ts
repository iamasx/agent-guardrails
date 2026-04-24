import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeGuardedTxn, makeIncident } from "../../__tests__/fixtures/prisma-rows.js";

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so they exist when hoisted vi.mock factories run
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockEmitter,
  mockPauseAgent,
  mockGenerateReport,
} = vi.hoisted(() => ({
  mockPrisma: {
    incident: { create: vi.fn() },
  },
  mockEmitter: { emitEvent: vi.fn() },
  mockPauseAgent: vi.fn().mockResolvedValue("mock-tx-sig"),
  mockGenerateReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));
vi.mock("../../sse/emitter.js", () => ({ sseEmitter: mockEmitter }));

vi.mock("../../config/env.js", () => ({
  env: {
    SOLANA_RPC_URL: "https://test.rpc",
    GUARDRAILS_PROGRAM_ID: "TestProgramId11111111111111111111",
    MONITOR_KEYPAIR: Buffer.from(
      JSON.stringify(Array.from({ length: 64 }, (_, i) => i)),
    ).toString("base64"),
  },
}));

vi.mock("../../sdk/client.js", () => ({
  GuardrailsClient: class MockGuardrailsClient {
    async pauseAgent(...args: unknown[]) { return mockPauseAgent(...args); }
  },
}));

vi.mock("@coral-xyz/anchor", () => ({
  AnchorProvider: vi.fn(),
  Wallet: vi.fn(),
}));

vi.mock("@solana/web3.js", () => ({
  Connection: vi.fn(),
  Keypair: {
    fromSecretKey: vi.fn().mockReturnValue({
      publicKey: { toBase58: () => "MockMonitorPubkey1111111111111111" },
    }),
  },
  PublicKey: vi.fn().mockImplementation((key: string) => ({
    toBase58: () => key,
    toString: () => key,
  })),
}));

vi.mock("./reporter.js", () => ({
  generateReport: (...args: unknown[]) => mockGenerateReport(...args),
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { executePause } = await import("./executor.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Re-set defaults after clearAllMocks removes return values
  mockPauseAgent.mockResolvedValue("mock-tx-sig");
  mockGenerateReport.mockResolvedValue(undefined);

  // Default: incident.create returns a proper incident object
  mockPrisma.incident.create.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve(
      makeIncident({
        policyPubkey: args.data.policyPubkey,
        pausedBy: args.data.pausedBy,
        reason: args.data.reason,
        triggeringTxnSig: args.data.triggeringTxnSig,
        judgeVerdictId: args.data.judgeVerdictId,
      }),
    ),
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("executePause", () => {
  it("creates Incident row with correct fields", async () => {
    const row = makeGuardedTxn({
      policyPubkey: "PolicyAbc111111111111111111111111",
      txnSig: "sig-trigger-xyz",
    });

    await executePause(row, "verdict-id-123", "Burst detected");

    expect(mockPrisma.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          policyPubkey: "PolicyAbc111111111111111111111111",
          reason: "Burst detected",
          triggeringTxnSig: "sig-trigger-xyz",
          judgeVerdictId: "verdict-id-123",
          pausedBy: "MockMonitorPubkey1111111111111111",
        }),
      }),
    );
  });

  it("emits agent_paused SSE event with full incident data", async () => {
    const row = makeGuardedTxn();

    await executePause(row, "v-1", "Test reason");

    expect(mockEmitter.emitEvent).toHaveBeenCalledWith(
      "agent_paused",
      expect.objectContaining({
        id: expect.any(String),
        policyPubkey: expect.any(String),
        pausedAt: expect.any(Date),
        pausedBy: expect.any(String),
        reason: expect.any(String),
        triggeringTxnSig: expect.any(String),
        judgeVerdictId: expect.any(String),
        fullReport: null,
        resolvedAt: null,
        resolution: null,
        createdAt: expect.any(Date),
      }),
    );
  });

  it("calls generateReport fire-and-forget", async () => {
    const row = makeGuardedTxn({ policyPubkey: "PolicyXyz111111111111111111111111" });

    await executePause(row, "v-2", "Drain pattern");

    expect(mockGenerateReport).toHaveBeenCalledWith(
      expect.any(String), // incidentId
      "PolicyXyz111111111111111111111111",
    );
  });

  it("does not throw when generateReport rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockGenerateReport.mockRejectedValue(new Error("report generation failed"));

    const row = makeGuardedTxn();

    // executePause itself should NOT throw
    await expect(executePause(row, "v-3", "Test")).resolves.toBeUndefined();

    // Give the fire-and-forget .catch handler a tick to run
    await new Promise((r) => setTimeout(r, 0));

    errorSpy.mockRestore();
  });

  it("truncates reason to 64 chars (pauseAgent call)", async () => {
    const row = makeGuardedTxn();
    const longReason = "A".repeat(100);

    await executePause(row, "v-4", longReason);

    // The pauseAgent call should receive truncated reason
    expect(mockPauseAgent).toHaveBeenCalledWith(
      expect.anything(), // policyPubkey
      "A".repeat(64),
    );
  });

  it("uses monitor pubkey as pausedBy", async () => {
    const row = makeGuardedTxn();

    await executePause(row, "v-5", "Reason");

    const createArgs = mockPrisma.incident.create.mock.calls[0][0];
    expect(createArgs.data.pausedBy).toBe("MockMonitorPubkey1111111111111111");
  });
});
