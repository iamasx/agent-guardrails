// Worker router — receives Helius webhooks and runs the anomaly pipeline.

import express from "express";
import { webhookHandler } from "./routes/webhook.js";

export const workerRouter: express.Router = express.Router();

// Parse JSON body and store raw buffer for HMAC verification.
// This runs before express.json() on /api routes (see src/index.ts).
workerRouter.post(
  "/webhook",
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
  webhookHandler,
);
