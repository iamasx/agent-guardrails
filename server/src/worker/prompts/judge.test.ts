import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JudgeContext } from "../../types/anomaly.js";

// ---------------------------------------------------------------------------
// Mock Prisma before importing the module under test.
// vi.hoisted ensures these fns exist when the hoisted vi.mock factory runs.
// ---------------------------------------------------------------------------
const { mockFindUniqueOrThrow, mockFindMany } = vi.hoisted(() => ({
  mockFindUniqueOrThrow: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock("../../db/client.js", () => ({
  prisma: {
    policy: { findUniqueOrThrow: mockFindUniqueOrThrow },
    guardedTxn: { findMany: mockFindMany },
  },
}));

import {
  JUDGE_SYSTEM,
  buildJudgeUserMessage,
  buildJudgeContext,
} from "./judge.js";

import { makePolicy, makeGuardedTxn } from "../../__tests__/fixtures/prisma-rows.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJudgeContext(overrides?: Partial<JudgeContext>): JudgeContext {
  return {
    policy: {
      agent: "AgentPubkey11111111111111111111111",
      allowedPrograms: ["TargetProgram1111111111111111111111", "11111111111111111111111111111111"],
      maxTxSol: 1,
      dailyBudgetSol: 10,
      dailyUsedPct: 25,
      minsToExpiry: 120,
    },
    txn: {
      program: "TargetProgram1111111111111111111111",
      programLabel: "whitelisted",
      amountSol: 0.1,
      pctOfCap: 10,
      timestamp: "2025-01-15T12:00:00.000Z",
    },
    history: [
      { program: "11111111111111111111111111111111", amountSol: 0.05, status: "executed", minsAgo: 5 },
      { program: "TargetProgram1111111111111111111111", amountSol: 0.2, status: "executed", minsAgo: 30 },
    ],
    baseline: {
      medianAmount: 0.1,
      p95Amount: 0.5,
      activeHours: "8-16 UTC",
      uniqueProgramsCount: 3,
    },
    prefilterSignals: ["burst_detected", "high_amount"],
    ...overrides,
  };
}

// ===========================================================================
// buildJudgeUserMessage — pure function tests, no mocking
// ===========================================================================

describe("buildJudgeUserMessage", () => {
  it("includes policy agent and allowed programs", () => {
    const ctx = makeJudgeContext();
    const msg = buildJudgeUserMessage(ctx);

    expect(msg).toContain(`Agent: ${ctx.policy.agent}`);
    expect(msg).toContain(
      `Allowed programs: ${ctx.policy.allowedPrograms.join(", ")}`,
    );
  });

  it("includes per-tx cap and daily budget in SOL", () => {
    const ctx = makeJudgeContext({
      policy: {
        ...makeJudgeContext().policy,
        maxTxSol: 2.5,
        dailyBudgetSol: 50,
      },
    });
    const msg = buildJudgeUserMessage(ctx);

    expect(msg).toContain("Per-tx cap: 2.5 SOL");
    expect(msg).toContain("Daily budget: 50 SOL");
  });

  it("includes daily used percentage and session expiry", () => {
    const ctx = makeJudgeContext({
      policy: {
        ...makeJudgeContext().policy,
        dailyUsedPct: 73,
        minsToExpiry: 45,
      },
    });
    const msg = buildJudgeUserMessage(ctx);

    expect(msg).toContain("73% used today");
    expect(msg).toContain("Session expires in: 45 minutes");
  });

  it("includes transaction program, amount, and timestamp", () => {
    const ctx = makeJudgeContext({
      txn: {
        program: "SomeProgramId1111111111111111111111",
        amountSol: 0.75,
        pctOfCap: 75,
        timestamp: "2025-03-20T09:30:00.000Z",
      },
    });
    const msg = buildJudgeUserMessage(ctx);

    expect(msg).toContain("Target program: SomeProgramId1111111111111111111111");
    expect(msg).toContain("Amount: 0.75 SOL (75% of per-tx cap)");
    expect(msg).toContain("Time: 2025-03-20T09:30:00.000Z");
  });

  it("labels known programs like System Program and Jupiter", () => {
    const ctx = makeJudgeContext({
      txn: {
        program: "11111111111111111111111111111111",
        programLabel: "System Program",
        amountSol: 0.01,
        pctOfCap: 1,
        timestamp: "2025-01-15T12:00:00.000Z",
      },
    });
    const msg = buildJudgeUserMessage(ctx);
    expect(msg).toContain("(System Program)");

    const ctx2 = makeJudgeContext({
      txn: {
        program: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        programLabel: "Jupiter v6",
        amountSol: 0.5,
        pctOfCap: 50,
        timestamp: "2025-01-15T12:00:00.000Z",
      },
    });
    const msg2 = buildJudgeUserMessage(ctx2);
    expect(msg2).toContain("(Jupiter v6)");
  });

  it("shows UNKNOWN for unrecognized programs", () => {
    const ctx = makeJudgeContext({
      txn: {
        program: "UnknownProgram11111111111111111111",
        programLabel: undefined,
        amountSol: 0.1,
        pctOfCap: 10,
        timestamp: "2025-01-15T12:00:00.000Z",
      },
    });
    const msg = buildJudgeUserMessage(ctx);
    expect(msg).toContain("(UNKNOWN to this agent)");
  });

  it("formats history as numbered list", () => {
    const ctx = makeJudgeContext({
      history: [
        { program: "Prog1", amountSol: 0.1, status: "executed", minsAgo: 2 },
        { program: "Prog2", amountSol: 0.5, status: "rejected", minsAgo: 10 },
        { program: "Prog3", amountSol: 1.0, status: "executed", minsAgo: 60 },
      ],
    });
    const msg = buildJudgeUserMessage(ctx);

    expect(msg).toContain("1. Prog1 | 0.1 SOL | executed | 2m ago");
    expect(msg).toContain("2. Prog2 | 0.5 SOL | rejected | 10m ago");
    expect(msg).toContain("3. Prog3 | 1 SOL | executed | 60m ago");
  });

  it("shows '(no history)' when history is empty", () => {
    const ctx = makeJudgeContext({ history: [] });
    const msg = buildJudgeUserMessage(ctx);

    expect(msg).toContain("(no history)");
  });

  it("includes baseline stats", () => {
    const ctx = makeJudgeContext({
      baseline: {
        medianAmount: 0.123456,
        p95Amount: 1.5,
        activeHours: "6-22 UTC",
        uniqueProgramsCount: 7,
      },
    });
    const msg = buildJudgeUserMessage(ctx);

    expect(msg).toContain("Median tx amount: 0.123456 SOL");
    expect(msg).toContain("p95 tx amount: 1.5 SOL");
    expect(msg).toContain("Typical active hours: 6-22 UTC");
    expect(msg).toContain("Programs used ever: 7");
  });

  it("includes prefilter signals or 'none' when empty", () => {
    const ctx = makeJudgeContext({
      prefilterSignals: ["new_program", "high_amount"],
    });
    const msg = buildJudgeUserMessage(ctx);
    expect(msg).toContain("PRE-FILTER SIGNALS: new_program, high_amount");

    const ctxEmpty = makeJudgeContext({ prefilterSignals: [] });
    const msgEmpty = buildJudgeUserMessage(ctxEmpty);
    expect(msgEmpty).toContain("PRE-FILTER SIGNALS: none");
  });
});

// ===========================================================================
// buildJudgeContext — needs Prisma mock
// ===========================================================================

describe("buildJudgeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T14:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches policy via findUniqueOrThrow", async () => {
    const policy = makePolicy();
    mockFindUniqueOrThrow.mockResolvedValue(policy);
    mockFindMany.mockResolvedValue([]);

    const row = makeGuardedTxn();
    await buildJudgeContext(row, []);

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { pubkey: row.policyPubkey },
    });
  });

  it("fetches last 20 txns excluding current row", async () => {
    const policy = makePolicy();
    const row = makeGuardedTxn();
    mockFindUniqueOrThrow.mockResolvedValue(policy);
    mockFindMany.mockResolvedValue([]);

    await buildJudgeContext(row, []);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { policyPubkey: row.policyPubkey, id: { not: row.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });

  it("calculates dailyUsedPct from today's transactions", async () => {
    const policy = makePolicy({ dailyBudgetLamports: BigInt(10_000_000_000) });
    const row = makeGuardedTxn();

    // Create two txns from today that sum to 2 SOL (20% of 10 SOL budget)
    const todayTxn1 = makeGuardedTxn({
      amountLamports: BigInt(1_000_000_000),
      createdAt: new Date("2025-06-15T10:00:00.000Z"),
    });
    const todayTxn2 = makeGuardedTxn({
      amountLamports: BigInt(1_000_000_000),
      createdAt: new Date("2025-06-15T12:00:00.000Z"),
    });
    // Yesterday's txn should not count
    const yesterdayTxn = makeGuardedTxn({
      amountLamports: BigInt(5_000_000_000),
      createdAt: new Date("2025-06-14T10:00:00.000Z"),
    });

    mockFindUniqueOrThrow.mockResolvedValue(policy);
    mockFindMany.mockResolvedValue([todayTxn1, todayTxn2, yesterdayTxn]);

    const ctx = await buildJudgeContext(row, []);

    expect(ctx.policy.dailyUsedPct).toBe(20);
  });

  it("returns dailyUsedPct=0 when dailyBudgetLamports is 0", async () => {
    const policy = makePolicy({ dailyBudgetLamports: BigInt(0) });
    const row = makeGuardedTxn();

    const todayTxn = makeGuardedTxn({
      amountLamports: BigInt(500_000_000),
      createdAt: new Date("2025-06-15T10:00:00.000Z"),
    });

    mockFindUniqueOrThrow.mockResolvedValue(policy);
    mockFindMany.mockResolvedValue([todayTxn]);

    const ctx = await buildJudgeContext(row, []);

    expect(ctx.policy.dailyUsedPct).toBe(0);
  });

  it("computes median and p95 amounts, filtering zeros", async () => {
    const policy = makePolicy();
    const row = makeGuardedTxn();

    // Create txns with known amounts (in lamports).
    // 0.1, 0.2, 0.3, 0.4, 0.5 SOL => sorted: [0.1, 0.2, 0.3, 0.4, 0.5]
    // Also include one with null and one with 0 to verify they are filtered out.
    const txns = [
      makeGuardedTxn({ amountLamports: BigInt(100_000_000), createdAt: new Date("2025-06-14T10:00:00Z") }),
      makeGuardedTxn({ amountLamports: BigInt(200_000_000), createdAt: new Date("2025-06-14T11:00:00Z") }),
      makeGuardedTxn({ amountLamports: BigInt(300_000_000), createdAt: new Date("2025-06-14T12:00:00Z") }),
      makeGuardedTxn({ amountLamports: BigInt(400_000_000), createdAt: new Date("2025-06-14T13:00:00Z") }),
      makeGuardedTxn({ amountLamports: BigInt(500_000_000), createdAt: new Date("2025-06-14T14:00:00Z") }),
      makeGuardedTxn({ amountLamports: null, createdAt: new Date("2025-06-14T15:00:00Z") }),
      makeGuardedTxn({ amountLamports: BigInt(0), createdAt: new Date("2025-06-14T16:00:00Z") }),
    ];

    mockFindUniqueOrThrow.mockResolvedValue(policy);
    mockFindMany.mockResolvedValue(txns);

    const ctx = await buildJudgeContext(row, []);

    // After filtering zeros/nulls: [0.1, 0.2, 0.3, 0.4, 0.5] (5 items)
    // Median = index Math.floor(5/2) = index 2 => 0.3
    // p95 = index Math.floor(5*0.95) = index 4 => 0.5
    expect(ctx.baseline.medianAmount).toBe(0.3);
    expect(ctx.baseline.p95Amount).toBe(0.5);
  });

  it("returns 0 amounts when no history", async () => {
    const policy = makePolicy();
    const row = makeGuardedTxn();

    mockFindUniqueOrThrow.mockResolvedValue(policy);
    mockFindMany.mockResolvedValue([]);

    const ctx = await buildJudgeContext(row, []);

    expect(ctx.baseline.medianAmount).toBe(0);
    expect(ctx.baseline.p95Amount).toBe(0);
  });

  it("formats activeHours as range or 'unknown'", async () => {
    const policy = makePolicy();
    const row = makeGuardedTxn();

    // Txns at hours 8, 12, 16 UTC
    const txns = [
      makeGuardedTxn({ createdAt: new Date("2025-06-14T08:30:00Z") }),
      makeGuardedTxn({ createdAt: new Date("2025-06-14T12:00:00Z") }),
      makeGuardedTxn({ createdAt: new Date("2025-06-14T16:45:00Z") }),
    ];

    mockFindUniqueOrThrow.mockResolvedValue(policy);
    mockFindMany.mockResolvedValue(txns);

    const ctx = await buildJudgeContext(row, []);

    // Hours 8, 12, 16 => range "8\u201316 UTC"
    expect(ctx.baseline.activeHours).toMatch(/^8.16 UTC$/);

    // No history => "unknown"
    mockFindMany.mockResolvedValue([]);
    const ctx2 = await buildJudgeContext(row, []);
    expect(ctx2.baseline.activeHours).toBe("unknown");
  });

  it("clamps minsToExpiry to >= 0", async () => {
    // Session already expired 1 hour ago
    const policy = makePolicy({
      sessionExpiry: new Date("2025-06-15T13:00:00.000Z"), // 1 hour before "now"
    });
    const row = makeGuardedTxn();

    mockFindUniqueOrThrow.mockResolvedValue(policy);
    mockFindMany.mockResolvedValue([]);

    const ctx = await buildJudgeContext(row, []);

    expect(ctx.policy.minsToExpiry).toBe(0);
  });
});
