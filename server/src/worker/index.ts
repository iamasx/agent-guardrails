// Worker router — receives Helius webhooks and runs the anomaly pipeline.
// Routes and pipeline stages will be wired in Phase 2.

import express from "express";

export const workerRouter: express.Router = express.Router();

// POST /webhook will be mounted here in Phase 2
