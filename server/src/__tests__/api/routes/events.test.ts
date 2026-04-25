import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// Create the test emitter at module scope so the mock captures it
const testEmitter = new EventEmitter();
testEmitter.setMaxListeners(100);

vi.mock("../../sse/emitter.js", () => ({ sseEmitter: testEmitter }));

const mockPrisma = {
  policy: { findUnique: vi.fn(), findMany: vi.fn() },
  guardedTxn: { findMany: vi.fn(), count: vi.fn() },
  incident: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  authSession: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};
vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));

const { eventsRouter } = await import("../../../api/routes/events.js");

const WALLET = "OwnerPubkey11111111111111111111111";
const OWNED_POLICY = "OwnedPolicy11111111111111111111111";
const UNOWNED_POLICY = "UnownedPolicy111111111111111111111";

function mockResponse() {
  const chunks: string[] = [];
  const res = {
    writeHead: vi.fn(),
    write: vi.fn((data: string) => {
      chunks.push(data);
      return true;
    }),
    on: vi.fn(),
  };
  return { res, chunks };
}

function mockRequest(walletPubkey: string) {
  const closeHandlers: Function[] = [];
  const req = {
    walletPubkey,
    on: vi.fn((event: string, handler: Function) => {
      if (event === "close") closeHandlers.push(handler);
    }),
  };
  return { req, closeHandlers };
}

// Helper to invoke the route handler directly
async function invokeHandler(req: any, res: any) {
  // The router has a single GET "/" handler. Extract and call it.
  const layer = (eventsRouter as any).stack.find(
    (l: any) => l.route && l.route.path === "/" && l.route.methods.get,
  );
  const handler = layer.route.stack[0].handle;
  await handler(req, res);
}

describe("GET /api/events (SSE)", () => {
  beforeEach(() => {
    testEmitter.removeAllListeners();
    mockPrisma.policy.findMany.mockResolvedValue([{ pubkey: OWNED_POLICY }]);
  });

  afterEach(() => {
    testEmitter.removeAllListeners();
  });

  it("sets Content-Type to text/event-stream", async () => {
    const { req } = mockRequest(WALLET);
    const { res } = mockResponse();

    await invokeHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ "Content-Type": "text/event-stream" }),
    );
  });

  it("sets Cache-Control to no-cache", async () => {
    const { req } = mockRequest(WALLET);
    const { res } = mockResponse();

    await invokeHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ "Cache-Control": "no-cache" }),
    );
  });

  it("sets Connection to keep-alive", async () => {
    const { req } = mockRequest(WALLET);
    const { res } = mockResponse();

    await invokeHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ Connection: "keep-alive" }),
    );
  });

  it("sends initial :ok keepalive", async () => {
    const { req } = mockRequest(WALLET);
    const { res, chunks } = mockResponse();

    await invokeHandler(req, res);

    expect(chunks[0]).toBe(":ok\n\n");
  });

  it("forwards new_transaction events for owned policies", async () => {
    const { req } = mockRequest(WALLET);
    const { res, chunks } = mockResponse();

    await invokeHandler(req, res);

    const payload = { policyPubkey: OWNED_POLICY, txnSig: "abc123" };
    testEmitter.emit("new_transaction", payload);

    const eventChunk = chunks.find((c) => c.includes("event: new_transaction"));
    expect(eventChunk).toBeDefined();
    expect(eventChunk).toContain(JSON.stringify(payload));
  });

  it("forwards verdict events for owned policies", async () => {
    const { req } = mockRequest(WALLET);
    const { res, chunks } = mockResponse();

    await invokeHandler(req, res);

    const payload = { policyPubkey: OWNED_POLICY, verdict: "allow" };
    testEmitter.emit("verdict", payload);

    const eventChunk = chunks.find((c) => c.includes("event: verdict"));
    expect(eventChunk).toBeDefined();
    expect(eventChunk).toContain(JSON.stringify(payload));
  });

  it("forwards agent_paused events for owned policies", async () => {
    const { req } = mockRequest(WALLET);
    const { res, chunks } = mockResponse();

    await invokeHandler(req, res);

    const payload = { policyPubkey: OWNED_POLICY, reason: "anomaly" };
    testEmitter.emit("agent_paused", payload);

    const eventChunk = chunks.find((c) => c.includes("event: agent_paused"));
    expect(eventChunk).toBeDefined();
    expect(eventChunk).toContain(JSON.stringify(payload));
  });

  it("forwards report_ready events for owned policies", async () => {
    const { req } = mockRequest(WALLET);
    const { res, chunks } = mockResponse();

    await invokeHandler(req, res);

    const payload = { policyPubkey: OWNED_POLICY, incidentId: "inc-1" };
    testEmitter.emit("report_ready", payload);

    const eventChunk = chunks.find((c) => c.includes("event: report_ready"));
    expect(eventChunk).toBeDefined();
    expect(eventChunk).toContain(JSON.stringify(payload));
  });

  it("filters out events for unowned policies", async () => {
    const { req } = mockRequest(WALLET);
    const { res, chunks } = mockResponse();

    await invokeHandler(req, res);

    const payload = { policyPubkey: UNOWNED_POLICY, txnSig: "should-not-appear" };
    testEmitter.emit("new_transaction", payload);

    // Only the initial :ok should be in chunks
    const eventChunks = chunks.filter((c) => c.includes("event: new_transaction"));
    expect(eventChunks).toHaveLength(0);
  });

  it("formats events as SSE protocol", async () => {
    const { req } = mockRequest(WALLET);
    const { res, chunks } = mockResponse();

    await invokeHandler(req, res);

    const payload = { policyPubkey: OWNED_POLICY, data: "test" };
    testEmitter.emit("verdict", payload);

    const eventChunk = chunks.find((c) => c.includes("event: verdict"));
    expect(eventChunk).toBe(`event: verdict\ndata: ${JSON.stringify(payload)}\n\n`);
  });

  it("removes listeners on client disconnect", async () => {
    const { req, closeHandlers } = mockRequest(WALLET);
    const { res } = mockResponse();

    await invokeHandler(req, res);

    // Should have registered a close handler
    expect(req.on).toHaveBeenCalledWith("close", expect.any(Function));
    expect(closeHandlers).toHaveLength(1);

    const listenersBefore = testEmitter.listenerCount("new_transaction");
    expect(listenersBefore).toBeGreaterThan(0);

    // Simulate client disconnect
    closeHandlers[0]();

    expect(testEmitter.listenerCount("new_transaction")).toBe(0);
    expect(testEmitter.listenerCount("verdict")).toBe(0);
    expect(testEmitter.listenerCount("agent_paused")).toBe(0);
    expect(testEmitter.listenerCount("report_ready")).toBe(0);
  });

  it("registers listeners on all 4 event types", async () => {
    const { req } = mockRequest(WALLET);
    const { res } = mockResponse();

    await invokeHandler(req, res);

    expect(testEmitter.listenerCount("new_transaction")).toBe(1);
    expect(testEmitter.listenerCount("verdict")).toBe(1);
    expect(testEmitter.listenerCount("agent_paused")).toBe(1);
    expect(testEmitter.listenerCount("report_ready")).toBe(1);
  });
});
