// Express application entry point.
// Mounts worker router (webhook ingestion) and API router (REST + SSE + auth).

import express from "express";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { corsMiddleware } from "./api/middleware/cors.js";
import { workerRouter } from "./worker/index.js";
import { apiRouter } from "./api/index.js";

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(corsMiddleware);
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Worker module: Helius webhook ingestion + anomaly pipeline
// Mounted before express.json() so webhook can access the raw body for HMAC verification.
app.use(workerRouter);

// API module: REST routes + SSE stream + SIWS auth (all under /api)
app.use("/api", express.json(), apiRouter);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(env.PORT, () => {
  console.log(`[guardrails-server] listening on port ${env.PORT}`);
});
