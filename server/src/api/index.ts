// API router — REST endpoints + SSE stream + SIWS auth for the dashboard.

import express from "express";
import { authMiddleware } from "./middleware/auth.js";
import { transactionsRouter } from "./routes/transactions.js";
import { incidentsRouter } from "./routes/incidents.js";
import { policiesRouter } from "./routes/policies.js";
import { eventsRouter } from "./routes/events.js";
import { authRouter } from "./routes/auth.js";

export const apiRouter: express.Router = express.Router();

// Auth middleware — skips /auth/* routes internally
apiRouter.use(authMiddleware);

// Auth routes (no JWT required)
apiRouter.use("/auth", authRouter);

// Protected REST routes
apiRouter.use("/transactions", transactionsRouter);
apiRouter.use("/incidents", incidentsRouter);
apiRouter.use("/policies", policiesRouter);

// SSE stream
apiRouter.use("/events", eventsRouter);
