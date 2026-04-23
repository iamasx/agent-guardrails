import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";

vi.mock("../../config/env.js", () => ({
  env: { JWT_SECRET: "test-jwt-secret-at-least-32-chars-long!!" },
}));

const JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!!";

// Import authMiddleware after mocking env
const { authMiddleware } = await import("./auth.js");

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(authMiddleware);
  app.get("/test", (req, res) => {
    res.json({ walletPubkey: (req as any).walletPubkey });
  });
  app.get("/auth/siws/nonce", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/auth/siws/verify", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/webhook", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("authMiddleware", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  it("skips auth for /webhook", async () => {
    const res = await request(app).get("/webhook");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("skips auth for /auth/siws/nonce", async () => {
    const res = await request(app).get("/auth/siws/nonce");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("skips auth for /auth/siws/verify", async () => {
    const res = await request(app).get("/auth/siws/verify");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 401 when no token anywhere", async () => {
    const res = await request(app).get("/test");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication required" });
  });

  it("reads token from httpOnly cookie named 'token'", async () => {
    const token = jwt.sign({ walletPubkey: "WalletFromCookie111111111111111111" }, JWT_SECRET, {
      expiresIn: "1h",
    });
    const res = await request(app)
      .get("/test")
      .set("Cookie", `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.walletPubkey).toBe("WalletFromCookie111111111111111111");
  });

  it("reads token from Authorization: Bearer header", async () => {
    const token = jwt.sign({ walletPubkey: "WalletFromHeader111111111111111111" }, JWT_SECRET, {
      expiresIn: "1h",
    });
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.walletPubkey).toBe("WalletFromHeader111111111111111111");
  });

  it("attaches walletPubkey to req when JWT is valid", async () => {
    const wallet = "AttachedWallet1111111111111111111111";
    const token = jwt.sign({ walletPubkey: wallet }, JWT_SECRET, { expiresIn: "1h" });
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.walletPubkey).toBe(wallet);
  });

  it("returns 401 for expired JWT", async () => {
    const token = jwt.sign({ walletPubkey: "SomeWallet111111111111111111111111" }, JWT_SECRET, {
      expiresIn: "-1s",
    });
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired token" });
  });

  it("returns 401 for JWT signed with wrong secret", async () => {
    const token = jwt.sign({ walletPubkey: "SomeWallet111111111111111111111111" }, "wrong-secret-wrong-secret-wrong-secret!!", {
      expiresIn: "1h",
    });
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired token" });
  });

  it("returns 401 for malformed JWT string", async () => {
    const res = await request(app)
      .get("/test")
      .set("Authorization", "Bearer not.a.valid.jwt.token");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired token" });
  });

  it("calls next() after attaching walletPubkey", async () => {
    const token = jwt.sign({ walletPubkey: "NextWallet111111111111111111111111" }, JWT_SECRET, {
      expiresIn: "1h",
    });
    // If next() is called, the route handler runs and returns the wallet
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("walletPubkey", "NextWallet111111111111111111111111");
  });

  it("handles missing cookies object gracefully", async () => {
    // Build an app without cookieParser — req.cookies will be undefined
    const noCookieApp = express();
    noCookieApp.use(express.json());
    noCookieApp.use(authMiddleware);
    noCookieApp.get("/test", (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(noCookieApp).get("/test");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication required" });
  });

  it("handles empty Authorization header", async () => {
    const res = await request(app)
      .get("/test")
      .set("Authorization", "");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication required" });
  });
});
