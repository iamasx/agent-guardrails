import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeGuardedTxn, makeAnomalyVerdict } from "../../__tests__/fixtures/prisma-rows.js";
import { makeAnthropicMessage } from "../../__tests__/fixtures/judge-response.js";

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so references survive mockReset
// ---------------------------------------------------------------------------

const {
  mockCreate,
  MockRateLimitError,
  mockBuildJudgeUserMessage,
  mockBuildJudgeContext,
} = vi.hoisted(() => {
  class _MockRateLimitError extends Error {
    status = 429;
    constructor() {
      super("rate limited");
      this.name = "RateLimitError";
    }
  }
  return {
    mockCreate: vi.fn(),
    MockRateLimitError: _MockRateLimitError,
    mockBuildJudgeUserMessage: vi.fn(),
    mockBuildJudgeContext: vi.fn(),
  };
});

const mockPrisma = {
  anomalyVerdict: { create: vi.fn() },
};
vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));

const mockEmitter = { emitEvent: vi.fn() };
vi.mock("../../sse/emitter.js", () => ({ sseEmitter: mockEmitter }));

vi.mock("../../config/env.js", () => ({
  env: {
    ANTHROPIC_API_KEY: "test-key",
    GUARDRAILS_PROGRAM_ID: "TestProgramId11111111111111111111",
  },
}));

// The source does `err instanceof Anthropic.RateLimitError` where Anthropic
// is the default import. The default class needs a static RateLimitError.
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    static RateLimitError = MockRateLimitError;
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

vi.mock("../prompts/judge.js", () => ({
  JUDGE_SYSTEM: "test system prompt",
  buildJudgeUserMessage: mockBuildJudgeUserMessage,
  buildJudgeContext: mockBuildJudgeContext,
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { judgeTransaction } = await import("./judge.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const successVerdict = {
  verdict: "allow" as const,
  confidence: 85,
  reasoning: "Routine transaction",
  signals: ["known_program"],
};

const defaultContext = {
  policy: {
    agent: "test",
    allowedPrograms: [],
    maxTxSol: 1,
    dailyBudgetSol: 10,
    dailyUsedPct: 0,
    minsToExpiry: 100,
  },
  txn: {
    program: "test",
    amountSol: 0.1,
    pctOfCap: 10,
    timestamp: "2025-01-01T00:00:00Z",
  },
  history: [],
  baseline: {
    medianAmount: 0.1,
    p95Amount: 0.5,
    activeHours: "0-23 UTC",
    uniqueProgramsCount: 1,
  },
  prefilterSignals: [],
};

function setupMocks() {
  mockBuildJudgeContext.mockResolvedValue(defaultContext);
  mockBuildJudgeUserMessage.mockReturnValue("test user message");
  mockPrisma.anomalyVerdict.create.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeAnomalyVerdict(args.data)),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("judgeTransaction", () => {
  it("calls Claude Haiku with correct model and params", async () => {
    mockCreate.mockResolvedValue(makeAnthropicMessage(successVerdict));

    const row = makeGuardedTxn();
    await judgeTransaction(row, []);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: "test system prompt",
        messages: [{ role: "user", content: "test user message" }],
      }),
    );
  });

  it("parses valid JSON verdict from response", async () => {
    mockCreate.mockResolvedValue(makeAnthropicMessage(successVerdict));

    const row = makeGuardedTxn();
    const result = await judgeTransaction(row, []);

    expect(result.verdict).toBe("allow");
    expect(result.confidence).toBe(85);
    expect(result.reasoning).toBe("Routine transaction");
    expect(result.signals).toEqual(["known_program"]);
  });

  it("strips ```json code fences before parsing", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '```json\n{"verdict":"flag","confidence":60,"reasoning":"Unusual","signals":["new_dest"]}\n```',
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const row = makeGuardedTxn();
    const result = await judgeTransaction(row, []);

    expect(result.verdict).toBe("flag");
    expect(result.confidence).toBe(60);
  });

  it("clamps confidence > 100 to 100", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicMessage({ ...successVerdict, confidence: 150 }),
    );

    const row = makeGuardedTxn();
    const result = await judgeTransaction(row, []);

    expect(result.confidence).toBe(100);
  });

  it("clamps negative confidence to 0", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicMessage({ ...successVerdict, confidence: -20 }),
    );

    const row = makeGuardedTxn();
    const result = await judgeTransaction(row, []);

    expect(result.confidence).toBe(0);
  });

  it("persists AnomalyVerdict row with model=claude-haiku-4-5", async () => {
    mockCreate.mockResolvedValue(makeAnthropicMessage(successVerdict));

    const row = makeGuardedTxn();
    await judgeTransaction(row, ["high_amount"]);

    expect(mockPrisma.anomalyVerdict.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          txnId: row.id,
          policyPubkey: row.policyPubkey,
          verdict: "allow",
          confidence: 85,
          model: "claude-haiku-4-5",
          prefilterSkipped: false,
          promptTokens: 100,
          completionTokens: 50,
        }),
      }),
    );
  });

  it("emits verdict SSE event with signals", async () => {
    mockCreate.mockResolvedValue(makeAnthropicMessage(successVerdict));

    const row = makeGuardedTxn();
    await judgeTransaction(row, []);

    expect(mockEmitter.emitEvent).toHaveBeenCalledWith(
      "verdict",
      expect.objectContaining({
        signals: ["known_program"],
      }),
    );
  });

  it("returns parsed verdict object", async () => {
    const pauseVerdict = {
      verdict: "pause" as const,
      confidence: 95,
      reasoning: "Drain sequence detected",
      signals: ["burst_detected", "high_amount"],
    };
    mockCreate.mockResolvedValue(makeAnthropicMessage(pauseVerdict));

    const row = makeGuardedTxn();
    const result = await judgeTransaction(row, ["burst_detected", "high_amount"]);

    expect(result).toEqual({
      verdict: "pause",
      confidence: 95,
      reasoning: "Drain sequence detected",
      signals: ["burst_detected", "high_amount"],
    });
  });
});

describe("timeout handling", () => {
  it("uses fallback when Claude takes > 3s", async () => {
    vi.useFakeTimers();

    mockCreate.mockImplementation(() => new Promise(() => {}));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, ["high_amount"]);

    await vi.advanceTimersByTimeAsync(3_001);

    const result = await resultPromise;

    expect(result.verdict).toBe("flag");
    expect(result.confidence).toBe(50);
    expect(result.signals).toContain("fallback");
  });

  it("records model=fallback and latencyMs=3000 for timeout", async () => {
    vi.useFakeTimers();

    mockCreate.mockImplementation(() => new Promise(() => {}));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, []);

    await vi.advanceTimersByTimeAsync(3_001);
    await resultPromise;

    expect(mockPrisma.anomalyVerdict.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          model: "fallback",
          latencyMs: 3000,
        }),
      }),
    );
  });
});

describe("rate limit (429)", () => {
  it("retries once after delay on RateLimitError", async () => {
    vi.useFakeTimers();

    mockCreate
      .mockRejectedValueOnce(new MockRateLimitError())
      .mockResolvedValueOnce(makeAnthropicMessage(successVerdict));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, []);

    // Advance past the 1s retry delay + some extra for the Promise.race timeout
    await vi.advanceTimersByTimeAsync(1_100);

    const result = await resultPromise;

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.verdict).toBe("allow");
  });

  it("uses retry result if retry succeeds", async () => {
    vi.useFakeTimers();

    const retryVerdict = {
      verdict: "flag" as const,
      confidence: 70,
      reasoning: "Flagged on retry",
      signals: ["retried"],
    };

    mockCreate
      .mockRejectedValueOnce(new MockRateLimitError())
      .mockResolvedValueOnce(makeAnthropicMessage(retryVerdict));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, []);

    await vi.advanceTimersByTimeAsync(1_100);

    const result = await resultPromise;

    expect(result.verdict).toBe("flag");
    expect(result.confidence).toBe(70);
    expect(result.reasoning).toBe("Flagged on retry");
  });

  it("falls back when retry also fails", async () => {
    vi.useFakeTimers();

    mockCreate
      .mockRejectedValueOnce(new MockRateLimitError())
      .mockImplementationOnce(() => new Promise(() => {}));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, ["burst_detected"]);

    // Advance past retry delay (1s) + timeout (3s) = 4s + buffer
    await vi.advanceTimersByTimeAsync(5_000);

    const result = await resultPromise;

    expect(result.verdict).toBe("pause");
    expect(result.signals).toContain("fallback");
  });
});

describe("malformed JSON", () => {
  it("returns flag verdict with 40% confidence", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "this is not valid json at all" }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const row = makeGuardedTxn();
    const result = await judgeTransaction(row, []);

    expect(result.verdict).toBe("flag");
    expect(result.confidence).toBe(40);
  });

  it("includes malformed_response signal", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "{invalid json" }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const row = makeGuardedTxn();
    const result = await judgeTransaction(row, []);

    expect(result.signals).toContain("malformed_response");
  });
});

describe("fallbackVerdict", () => {
  it("returns pause when burst_detected in signals", async () => {
    vi.useFakeTimers();

    mockCreate.mockImplementation(() => new Promise(() => {}));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, ["burst_detected"]);

    await vi.advanceTimersByTimeAsync(3_001);

    const result = await resultPromise;

    expect(result.verdict).toBe("pause");
  });

  it("returns flag otherwise", async () => {
    vi.useFakeTimers();

    mockCreate.mockImplementation(() => new Promise(() => {}));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, ["high_amount"]);

    await vi.advanceTimersByTimeAsync(3_001);

    const result = await resultPromise;

    expect(result.verdict).toBe("flag");
  });

  it("includes fallback signal", async () => {
    vi.useFakeTimers();

    mockCreate.mockImplementation(() => new Promise(() => {}));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, []);

    await vi.advanceTimersByTimeAsync(3_001);

    const result = await resultPromise;

    expect(result.signals).toContain("fallback");
  });

  it("confidence is 50 for all fallbacks", async () => {
    vi.useFakeTimers();

    mockCreate.mockImplementation(() => new Promise(() => {}));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, ["burst_detected"]);

    await vi.advanceTimersByTimeAsync(3_001);

    const result = await resultPromise;

    expect(result.confidence).toBe(50);
  });

  it("reasoning mentions timeout or fallback", async () => {
    vi.useFakeTimers();

    mockCreate.mockImplementation(() => new Promise(() => {}));

    const row = makeGuardedTxn();
    const resultPromise = judgeTransaction(row, []);

    await vi.advanceTimersByTimeAsync(3_001);

    const result = await resultPromise;

    expect(result.reasoning.toLowerCase()).toMatch(/timeout|fallback/);
  });
});
