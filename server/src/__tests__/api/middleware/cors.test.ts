import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../config/env.js", () => ({
  env: { CORS_ORIGIN: "https://dashboard.example.com" },
}));

const { corsMiddleware } = await import("../../../api/middleware/cors.js");

function buildApp() {
  const app = express();
  app.use(corsMiddleware);
  app.get("/test", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("corsMiddleware", () => {
  it("sets Access-Control-Allow-Origin to CORS_ORIGIN", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/test")
      .set("Origin", "https://dashboard.example.com");
    expect(res.headers["access-control-allow-origin"]).toBe("https://dashboard.example.com");
  });

  it("sets Access-Control-Allow-Credentials to true", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/test")
      .set("Origin", "https://dashboard.example.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows GET, POST, OPTIONS methods", async () => {
    const app = buildApp();
    const res = await request(app)
      .options("/test")
      .set("Origin", "https://dashboard.example.com")
      .set("Access-Control-Request-Method", "POST");
    const allowedMethods = res.headers["access-control-allow-methods"];
    expect(allowedMethods).toContain("GET");
    expect(allowedMethods).toContain("POST");
    expect(allowedMethods).toContain("OPTIONS");
  });

  it("allows Content-Type and Authorization headers", async () => {
    const app = buildApp();
    const res = await request(app)
      .options("/test")
      .set("Origin", "https://dashboard.example.com")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "Content-Type,Authorization");
    const allowedHeaders = res.headers["access-control-allow-headers"];
    expect(allowedHeaders).toContain("Content-Type");
    expect(allowedHeaders).toContain("Authorization");
  });

  it("responds to OPTIONS preflight with 204", async () => {
    const app = buildApp();
    const res = await request(app)
      .options("/test")
      .set("Origin", "https://dashboard.example.com")
      .set("Access-Control-Request-Method", "GET");
    expect(res.status).toBe(204);
  });
});
