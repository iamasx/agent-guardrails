import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  makePolicy,
  makeIncident,
  makeAnomalyVerdict,
} from "../../__tests__/fixtures/prisma-rows.js";

const mockPrisma = {
  policy: { findUnique: vi.fn(), findMany: vi.fn() },
  guardedTxn: { findMany: vi.fn(), count: vi.fn() },
  incident: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  authSession: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};
vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));

const { incidentsRouter } = await import("./incidents.js");

const WALLET = "OwnerPubkey11111111111111111111111";
const OTHER_WALLET = "OtherOwner1111111111111111111111111";

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

describe("GET /api/incidents", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(WALLET, incidentsRouter, "/api/incidents");
  });

  it("returns empty when wallet owns no policies", async () => {
    mockPrisma.policy.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/incidents");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ incidents: [], total: 0 });
  });

  it("returns incidents with judge verdict", async () => {
    const policy = makePolicy();
    const verdict = makeAnomalyVerdict();
    const incident = makeIncident({ judgeVerdict: verdict });
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.incident.findMany.mockResolvedValue([incident]);
    mockPrisma.incident.count.mockResolvedValue(1);

    const res = await request(app).get("/api/incidents");
    expect(res.status).toBe(200);
    expect(res.body.incidents).toHaveLength(1);
    expect(res.body.incidents[0].judgeVerdict).toBeDefined();
    // Verify include: { judgeVerdict: true } in the query
    expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { judgeVerdict: true } }),
    );
  });

  it("paginates with limit and offset", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);

    await request(app).get("/api/incidents?limit=10&offset=20");
    expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    );
  });

  it("clamps limit/offset to valid ranges", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);

    await request(app).get("/api/incidents?limit=999&offset=-5");
    expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 0 }),
    );
  });

  it("orders by pausedAt descending", async () => {
    const policy = makePolicy();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: policy.pubkey }]);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);

    await request(app).get("/api/incidents");
    expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { pausedAt: "desc" } }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.policy.findMany.mockRejectedValue(new Error("DB connection failed"));

    const res = await request(app).get("/api/incidents");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});

describe("GET /api/incidents/:id", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(WALLET, incidentsRouter, "/api/incidents");
  });

  it("returns incident when owned by wallet", async () => {
    const verdict = makeAnomalyVerdict();
    const incident = makeIncident({
      id: "inc-123",
      judgeVerdict: verdict,
    });
    mockPrisma.incident.findFirst.mockResolvedValue(incident);

    const res = await request(app).get("/api/incidents/inc-123");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("inc-123");
  });

  it("returns 404 when incident belongs to different wallet", async () => {
    // findFirst returns null when the ownership filter excludes the incident
    mockPrisma.incident.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/incidents/inc-other");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Incident not found" });
  });

  it("returns 404 when incident does not exist", async () => {
    mockPrisma.incident.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/incidents/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Incident not found" });
  });

  it("includes judgeVerdict relation", async () => {
    const incident = makeIncident({ judgeVerdict: makeAnomalyVerdict() });
    mockPrisma.incident.findFirst.mockResolvedValue(incident);

    await request(app).get(`/api/incidents/${incident.id}`);
    expect(mockPrisma.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ include: { judgeVerdict: true } }),
    );
  });

  it("does not leak policy data in response", async () => {
    const incident = makeIncident({ judgeVerdict: makeAnomalyVerdict() });
    mockPrisma.incident.findFirst.mockResolvedValue(incident);

    const res = await request(app).get(`/api/incidents/${incident.id}`);
    expect(res.status).toBe(200);
    // The findFirst query filters by policy.owner but does not include the policy relation
    expect(mockPrisma.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          policy: { owner: WALLET },
        }),
      }),
    );
    // Response should not have a nested policy object
    expect(res.body.policy).toBeUndefined();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.incident.findFirst.mockRejectedValue(new Error("DB connection failed"));

    const res = await request(app).get("/api/incidents/inc-err");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
