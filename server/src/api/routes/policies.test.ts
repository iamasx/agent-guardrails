import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { makePolicy } from "../../__tests__/fixtures/prisma-rows.js";

const mockPrisma = {
  policy: { findUnique: vi.fn(), findMany: vi.fn() },
  guardedTxn: { findMany: vi.fn(), count: vi.fn() },
  incident: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  authSession: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};
vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));

const { policiesRouter } = await import("./policies.js");

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

describe("GET /api/policies", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp(WALLET, policiesRouter, "/api/policies");
  });

  it("returns empty array when wallet owns no policies", async () => {
    mockPrisma.policy.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/policies");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ policies: [] });
  });

  it("returns policies owned by authenticated wallet", async () => {
    const policies = [
      makePolicy({ pubkey: "Policy1111111111111111111111111111" }),
      makePolicy({ pubkey: "Policy2222222222222222222222222222" }),
    ];
    mockPrisma.policy.findMany.mockResolvedValue(policies);

    const res = await request(app).get("/api/policies");
    expect(res.status).toBe(200);
    expect(res.body.policies).toHaveLength(2);
    // Verify the query filtered by owner
    expect(mockPrisma.policy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { owner: WALLET },
      }),
    );
  });

  it("serializes maxTxLamports as string", async () => {
    const policy = makePolicy({ maxTxLamports: BigInt(2_000_000_000) });
    mockPrisma.policy.findMany.mockResolvedValue([policy]);

    const res = await request(app).get("/api/policies");
    expect(res.body.policies[0].maxTxLamports).toBe("2000000000");
    expect(typeof res.body.policies[0].maxTxLamports).toBe("string");
  });

  it("serializes dailyBudgetLamports as string", async () => {
    const policy = makePolicy({ dailyBudgetLamports: BigInt(50_000_000_000) });
    mockPrisma.policy.findMany.mockResolvedValue([policy]);

    const res = await request(app).get("/api/policies");
    expect(res.body.policies[0].dailyBudgetLamports).toBe("50000000000");
    expect(typeof res.body.policies[0].dailyBudgetLamports).toBe("string");
  });

  it("serializes escalationThreshold as string or null", async () => {
    const policyWithThreshold = makePolicy({ escalationThreshold: BigInt(500_000_000) });
    const policyWithNull = makePolicy({ escalationThreshold: null });
    mockPrisma.policy.findMany.mockResolvedValue([policyWithThreshold, policyWithNull]);

    const res = await request(app).get("/api/policies");
    expect(res.body.policies[0].escalationThreshold).toBe("500000000");
    expect(typeof res.body.policies[0].escalationThreshold).toBe("string");
    expect(res.body.policies[1].escalationThreshold).toBeNull();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.policy.findMany.mockRejectedValue(new Error("DB connection failed"));

    const res = await request(app).get("/api/policies");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
