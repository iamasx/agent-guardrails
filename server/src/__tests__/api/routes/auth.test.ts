import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import nacl from "tweetnacl";
import { makeAuthSession } from "../../fixtures/prisma-rows.js";

vi.mock("../../config/env.js", () => ({
  env: { JWT_SECRET: "test-jwt-secret-at-least-32-chars-long!!" },
}));

const mockPrisma = {
  policy: { findUnique: vi.fn(), findMany: vi.fn() },
  guardedTxn: { findMany: vi.fn(), count: vi.fn() },
  incident: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  authSession: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};
vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));

const { authRouter } = await import("../../../api/routes/auth.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/auth", authRouter);
  return app;
}

// Helper: base64-encode a Uint8Array
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// Helper: sign a message with a tweetnacl keypair and return base64 signature
function signMessage(message: string, secretKey: Uint8Array): string {
  const messageBytes = new TextEncoder().encode(message);
  const sig = nacl.sign.detached(messageBytes, secretKey);
  return toBase64(sig);
}

describe("POST /auth/siws/nonce", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("returns 400 when pubkey is missing", async () => {
    const res = await request(app)
      .post("/auth/siws/nonce")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "pubkey is required" });
  });

  it("returns 400 when pubkey is not a string", async () => {
    const res = await request(app)
      .post("/auth/siws/nonce")
      .send({ pubkey: 12345 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "pubkey is required" });
  });

  it("creates AuthSession in database with nonce and 10min expiry", async () => {
    mockPrisma.authSession.create.mockResolvedValue(
      makeAuthSession({ walletPubkey: "TestPubkey11111111111111111111111" }),
    );

    const before = Date.now();
    await request(app)
      .post("/auth/siws/nonce")
      .send({ pubkey: "TestPubkey11111111111111111111111" });

    expect(mockPrisma.authSession.create).toHaveBeenCalledOnce();
    const createArg = mockPrisma.authSession.create.mock.calls[0][0];
    expect(createArg.data.walletPubkey).toBe("TestPubkey11111111111111111111111");
    expect(typeof createArg.data.nonce).toBe("string");
    expect(createArg.data.nonce.length).toBeGreaterThan(0);
    // Expiry should be ~10 minutes from now
    const expiry = new Date(createArg.data.expiresAt).getTime();
    const expectedMin = before + 9 * 60_000;
    const expectedMax = before + 11 * 60_000;
    expect(expiry).toBeGreaterThanOrEqual(expectedMin);
    expect(expiry).toBeLessThanOrEqual(expectedMax);
  });

  it("returns { nonce, message } with wallet and nonce embedded", async () => {
    mockPrisma.authSession.create.mockResolvedValue(
      makeAuthSession({ walletPubkey: "TestPubkey11111111111111111111111" }),
    );

    const res = await request(app)
      .post("/auth/siws/nonce")
      .send({ pubkey: "TestPubkey11111111111111111111111" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("nonce");
    expect(res.body).toHaveProperty("message");
    expect(typeof res.body.nonce).toBe("string");
    expect(typeof res.body.message).toBe("string");
  });

  it("message format includes wallet and nonce lines", async () => {
    mockPrisma.authSession.create.mockResolvedValue(
      makeAuthSession({ walletPubkey: "TestPubkey11111111111111111111111" }),
    );

    const res = await request(app)
      .post("/auth/siws/nonce")
      .send({ pubkey: "TestPubkey11111111111111111111111" });

    const { message, nonce } = res.body;
    expect(message).toContain("Wallet: TestPubkey11111111111111111111111");
    expect(message).toContain(`Nonce: ${nonce}`);
    expect(message).toContain("Sign this message to authenticate");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.authSession.create.mockRejectedValue(new Error("DB connection failed"));

    const res = await request(app)
      .post("/auth/siws/nonce")
      .send({ pubkey: "TestPubkey11111111111111111111111" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});

describe("POST /auth/siws/verify", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("returns 400 when pubkey/signature/message is missing", async () => {
    // Missing all
    let res = await request(app).post("/auth/siws/verify").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "pubkey, signature, and message are required" });

    // Missing signature
    res = await request(app)
      .post("/auth/siws/verify")
      .send({ pubkey: "abc", message: "msg" });
    expect(res.status).toBe(400);

    // Missing message
    res = await request(app)
      .post("/auth/siws/verify")
      .send({ pubkey: "abc", signature: "sig" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when message has no Nonce line", async () => {
    const res = await request(app)
      .post("/auth/siws/verify")
      .send({
        pubkey: "SomePubkey1111111111111111111111111",
        signature: toBase64(new Uint8Array(64)),
        message: "This message has no nonce in it",
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid message format" });
  });

  it("returns 401 when no matching session found", async () => {
    mockPrisma.authSession.findFirst.mockResolvedValue(null);

    const keypair = nacl.sign.keyPair();
    const pubkeyB64 = toBase64(keypair.publicKey);
    const nonce = "test-nonce-abc";
    const message = `Sign this message to authenticate with Agent Guardrails.\n\nWallet: ${pubkeyB64}\nNonce: ${nonce}`;
    const signature = signMessage(message, keypair.secretKey);

    const res = await request(app)
      .post("/auth/siws/verify")
      .send({ pubkey: pubkeyB64, signature, message });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired nonce" });
  });

  it("returns 401 when signature verification fails", async () => {
    const keypair = nacl.sign.keyPair();
    const wrongKeypair = nacl.sign.keyPair();
    const pubkeyB64 = toBase64(keypair.publicKey);
    const nonce = "test-nonce-verify-fail";
    const message = `Sign this message to authenticate with Agent Guardrails.\n\nWallet: ${pubkeyB64}\nNonce: ${nonce}`;

    // Sign with the wrong key
    const badSignature = signMessage(message, wrongKeypair.secretKey);

    const session = makeAuthSession({
      walletPubkey: pubkeyB64,
      nonce,
      signedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    mockPrisma.authSession.findFirst.mockResolvedValue(session);

    const res = await request(app)
      .post("/auth/siws/verify")
      .send({ pubkey: pubkeyB64, signature: badSignature, message });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid signature" });
  });

  it("marks session as signed on success", async () => {
    const keypair = nacl.sign.keyPair();
    const pubkeyB64 = toBase64(keypair.publicKey);
    const nonce = "test-nonce-sign-success";
    const message = `Sign this message to authenticate with Agent Guardrails.\n\nWallet: ${pubkeyB64}\nNonce: ${nonce}`;
    const signature = signMessage(message, keypair.secretKey);

    const session = makeAuthSession({
      id: "session-123",
      walletPubkey: pubkeyB64,
      nonce,
      signedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    mockPrisma.authSession.findFirst.mockResolvedValue(session);
    mockPrisma.authSession.update.mockResolvedValue({ ...session, signedAt: new Date() });

    await request(app)
      .post("/auth/siws/verify")
      .send({ pubkey: pubkeyB64, signature, message });

    expect(mockPrisma.authSession.update).toHaveBeenCalledWith({
      where: { id: "session-123" },
      data: { signedAt: expect.any(Date) },
    });
  });

  it("sets httpOnly cookie on success", async () => {
    const keypair = nacl.sign.keyPair();
    const pubkeyB64 = toBase64(keypair.publicKey);
    const nonce = "test-nonce-cookie";
    const message = `Sign this message to authenticate with Agent Guardrails.\n\nWallet: ${pubkeyB64}\nNonce: ${nonce}`;
    const signature = signMessage(message, keypair.secretKey);

    const session = makeAuthSession({
      walletPubkey: pubkeyB64,
      nonce,
      signedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    mockPrisma.authSession.findFirst.mockResolvedValue(session);
    mockPrisma.authSession.update.mockResolvedValue({ ...session, signedAt: new Date() });

    const res = await request(app)
      .post("/auth/siws/verify")
      .send({ pubkey: pubkeyB64, signature, message });

    expect(res.status).toBe(200);
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toContain("token=");
    expect(cookieStr).toContain("HttpOnly");
  });

  it("returns { ok: true } on success", async () => {
    const keypair = nacl.sign.keyPair();
    const pubkeyB64 = toBase64(keypair.publicKey);
    const nonce = "test-nonce-ok";
    const message = `Sign this message to authenticate with Agent Guardrails.\n\nWallet: ${pubkeyB64}\nNonce: ${nonce}`;
    const signature = signMessage(message, keypair.secretKey);

    const session = makeAuthSession({
      walletPubkey: pubkeyB64,
      nonce,
      signedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    mockPrisma.authSession.findFirst.mockResolvedValue(session);
    mockPrisma.authSession.update.mockResolvedValue({ ...session, signedAt: new Date() });

    const res = await request(app)
      .post("/auth/siws/verify")
      .send({ pubkey: pubkeyB64, signature, message });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 500 on database error", async () => {
    const keypair = nacl.sign.keyPair();
    const pubkeyB64 = toBase64(keypair.publicKey);
    const nonce = "test-nonce-dberr";
    const message = `Sign this message to authenticate with Agent Guardrails.\n\nWallet: ${pubkeyB64}\nNonce: ${nonce}`;
    const signature = signMessage(message, keypair.secretKey);

    mockPrisma.authSession.findFirst.mockRejectedValue(new Error("DB connection failed"));

    const res = await request(app)
      .post("/auth/siws/verify")
      .send({ pubkey: pubkeyB64, signature, message });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
