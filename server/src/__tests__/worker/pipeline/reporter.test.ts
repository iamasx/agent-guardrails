import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeIncident,
  makeGuardedTxn,
  makeAnomalyVerdict,
} from "../../fixtures/prisma-rows.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  guardedTxn: { findMany: vi.fn() },
  incident: { findUnique: vi.fn(), update: vi.fn() },
};
vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));

const mockEmitter = { emitEvent: vi.fn() };
vi.mock("../../sse/emitter.js", () => ({ sseEmitter: mockEmitter }));

vi.mock("../../config/env.js", () => ({
  env: {
    ANTHROPIC_API_KEY: "test-key",
  },
}));

const { mockCreate, mockBuildReportUserMessage } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockBuildReportUserMessage: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

vi.mock("../prompts/incident-report.js", () => ({
  REPORT_SYSTEM: "test report system prompt",
  buildReportUserMessage: mockBuildReportUserMessage,
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { generateReport } = await import("../../../worker/pipeline/reporter.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIncidentWithVerdict(overrides?: Record<string, unknown>) {
  return {
    ...makeIncident(),
    judgeVerdict: makeAnomalyVerdict(),
    ...overrides,
  };
}

function makeTxnWithVerdict(overrides?: Record<string, unknown>) {
  return {
    ...makeGuardedTxn(),
    verdict: makeAnomalyVerdict(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Defaults — re-set after clearAllMocks removes return values
  mockBuildReportUserMessage.mockReturnValue("test report user message");
  mockPrisma.guardedTxn.findMany.mockResolvedValue([makeTxnWithVerdict()]);
  mockPrisma.incident.findUnique.mockResolvedValue(makeIncidentWithVerdict());
  mockPrisma.incident.update.mockResolvedValue(makeIncident({ fullReport: "report text" }));
  mockCreate.mockResolvedValue({
    content: [{ type: "text", text: "## Incident Report\nDetails here." }],
    usage: { input_tokens: 500, output_tokens: 1000 },
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateReport", () => {
  it("fetches last 24h transactions for the policy", async () => {
    await generateReport("inc-1", "PolicyPda1111111111111111111111111");

    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          policyPubkey: "PolicyPda1111111111111111111111111",
          createdAt: { gte: expect.any(Date) },
        }),
        include: { verdict: true },
        orderBy: { createdAt: "asc" },
      }),
    );

    // Verify the gte date is approximately 24 hours ago
    const callArgs = mockPrisma.guardedTxn.findMany.mock.calls[0][0];
    const gteDate = callArgs.where.createdAt.gte as Date;
    const msAgo = Date.now() - gteDate.getTime();
    // Should be ~24 hours = 86_400_000 ms (allow 5s tolerance)
    expect(msAgo).toBeGreaterThan(86_400_000 - 5000);
    expect(msAgo).toBeLessThan(86_400_000 + 5000);
  });

  it("fetches incident with judge verdict", async () => {
    await generateReport("inc-2", "PolicyPda1111111111111111111111111");

    expect(mockPrisma.incident.findUnique).toHaveBeenCalledWith({
      where: { id: "inc-2" },
      include: { judgeVerdict: true },
    });
  });

  it("returns early when incident not found", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockPrisma.incident.findUnique.mockResolvedValue(null);

    await generateReport("nonexistent", "PolicyPda1111111111111111111111111");

    // Should not call Claude
    expect(mockCreate).not.toHaveBeenCalled();
    // Should not update incident
    expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    // Should not emit SSE
    expect(mockEmitter.emitEvent).not.toHaveBeenCalled();
    // Should log error
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));

    errorSpy.mockRestore();
  });

  it("calls Claude Sonnet with correct model", async () => {
    await generateReport("inc-3", "PolicyPda1111111111111111111111111");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 2048,
        system: "test report system prompt",
        messages: [{ role: "user", content: "test report user message" }],
      }),
    );
  });

  it("updates incident.fullReport in database", async () => {
    await generateReport("inc-4", "PolicyPda1111111111111111111111111");

    expect(mockPrisma.incident.update).toHaveBeenCalledWith({
      where: { id: "inc-4" },
      data: { fullReport: "## Incident Report\nDetails here." },
    });
  });

  it("emits report_ready SSE event", async () => {
    await generateReport("inc-5", "PolicyXyz111111111111111111111111");

    expect(mockEmitter.emitEvent).toHaveBeenCalledWith("report_ready", {
      incidentId: "inc-5",
      policyPubkey: "PolicyXyz111111111111111111111111",
      fullReport: "## Incident Report\nDetails here.",
    });
  });

  it("handles empty response content gracefully", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "image", source: {} }], // no text block
      usage: { input_tokens: 500, output_tokens: 0 },
    });

    await generateReport("inc-6", "PolicyPda1111111111111111111111111");

    // Should still update with empty string
    expect(mockPrisma.incident.update).toHaveBeenCalledWith({
      where: { id: "inc-6" },
      data: { fullReport: "" },
    });

    // Should still emit SSE
    expect(mockEmitter.emitEvent).toHaveBeenCalledWith("report_ready", {
      incidentId: "inc-6",
      policyPubkey: "PolicyPda1111111111111111111111111",
      fullReport: "",
    });
  });

  it("rejects on Claude API error (executor .catch() handles it)", async () => {
    mockCreate.mockRejectedValue(new Error("Claude API down"));

    // generateReport propagates the error — the executor's .catch() handles it
    await expect(
      generateReport("inc-7", "PolicyPda1111111111111111111111111"),
    ).rejects.toThrow("Claude API down");
  });

  it("logs report generation on success", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await generateReport("inc-8", "PolicyPda1111111111111111111111111");

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[reporter] generated report for incident inc-8"),
    );

    logSpy.mockRestore();
  });
});
