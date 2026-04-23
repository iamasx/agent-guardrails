import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  makePolicy,
  makeGuardedTxn,
  makeAnomalyVerdict,
} from "../../__tests__/fixtures/prisma-rows.js";

const mockPrisma = {
  policy: { findUnique: vi.fn(), findMany: vi.fn() },
  guardedTxn: { findMany: vi.fn(), count: vi.fn() },
  incident: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  authSession: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};
vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));

const { transactionsRouter } = await import("./transactions.js");

const WALLET = "OwnerPubkey11111111111111111111111";

function createTestApp(walletPubkey: string, router: express.Router, path: string) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    (req as any).walletPubkey = walletPubkey;
    next();
  });
  app.use(path, router);
  return app;
}

describe("GET /api/transactions", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp(WALLET, transactionsRouter, "/api/transactions");
  });

  it("returns empty when wallet owns no policies", async () => {
    mockPrisma.policy.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ transactions: [], total: 0 });
  });

  it("returns transactions for owned policies only", async () => {
    const policy = makePolicy();
    const txn = makeGuardedTxn({ verdict: null });
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([txn]);
    mockPrisma.guardedTxn.count.mockResolvedValue(1);

    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.total).toBe(1);
    // Verify the Prisma query was scoped to owned policies
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyPubkey: { in: [policy.pubkey] } },
      }),
    );
  });

  it("includes verdict relation in each transaction", async () => {
    const policy = makePolicy();
    const verdict = makeAnomalyVerdict();
    const txn = makeGuardedTxn({ verdict });
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([txn]);
    mockPrisma.guardedTxn.count.mockResolvedValue(1);

    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body.transactions[0].verdict).toBeDefined();
    // Verify include: { verdict: true } was passed
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { verdict: true } }),
    );
  });

  it("serializes slot as string", async () => {
    const policy = makePolicy();
    const txn = makeGuardedTxn({ slot: BigInt(999999999) });
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([txn]);
    mockPrisma.guardedTxn.count.mockResolvedValue(1);

    const res = await request(app).get("/api/transactions");
    expect(res.body.transactions[0].slot).toBe("999999999");
    expect(typeof res.body.transactions[0].slot).toBe("string");
  });

  it("serializes amountLamports as string", async () => {
    const policy = makePolicy();
    const txn = makeGuardedTxn({ amountLamports: BigInt(5_000_000_000) });
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([txn]);
    mockPrisma.guardedTxn.count.mockResolvedValue(1);

    const res = await request(app).get("/api/transactions");
    expect(res.body.transactions[0].amountLamports).toBe("5000000000");
    expect(typeof res.body.transactions[0].amountLamports).toBe("string");
  });

  it("handles null amountLamports (serializes as null)", async () => {
    const policy = makePolicy();
    const txn = makeGuardedTxn({ amountLamports: null });
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([txn]);
    mockPrisma.guardedTxn.count.mockResolvedValue(1);

    const res = await request(app).get("/api/transactions");
    expect(res.body.transactions[0].amountLamports).toBeNull();
  });

  it("defaults limit to 50 when not provided", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions");
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("clamps limit to max 100", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions?limit=500");
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("clamps limit to min 1 for negative values", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions?limit=-5");
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it("defaults offset to 0 when not provided", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions");
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it("clamps negative offset to 0", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions?offset=-10");
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it("handles NaN limit gracefully (uses default 50)", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions?limit=abc");
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("handles NaN offset gracefully (uses default 0)", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions?offset=xyz");
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it("filters by ?policy= when it matches an owned policy", async () => {
    const policy = makePolicy({ pubkey: "FilteredPolicy1111111111111111111" });
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions?policy=FilteredPolicy1111111111111111111");
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyPubkey: "FilteredPolicy1111111111111111111" },
      }),
    );
  });

  it("ignores ?policy= when policy not owned by wallet", async () => {
    const ownedPolicy = makePolicy({ pubkey: "OwnedPolicy11111111111111111111111" });
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: ownedPolicy.pubkey }]);
    mockPrisma.guardedTxn.findMany.mockResolvedValue([]);
    mockPrisma.guardedTxn.count.mockResolvedValue(0);

    await request(app).get("/api/transactions?policy=UnownedPolicy1111111111111111111");
    // Should fall back to { in: [owned pubkeys] } instead of using the unowned filter
    expect(mockPrisma.guardedTxn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyPubkey: { in: [ownedPolicy.pubkey] } },
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.policy.findMany.mockRejectedValue(new Error("DB connection failed"));

    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
