// GET /api/events — Server-Sent Events stream.
// Streams 4 event types from the SSE emitter, scoped to the authenticated wallet's policies.

import express from "express";
import { prisma } from "../../db/client.js";
import { sseEmitter, type SSEEventName } from "../../sse/emitter.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const eventsRouter: express.Router = express.Router();

const SSE_EVENTS: SSEEventName[] = [
  "new_transaction",
  "verdict",
  "agent_paused",
  "report_ready",
];

eventsRouter.get("/", async (req, res) => {
  const walletPubkey = (req as unknown as AuthenticatedRequest).walletPubkey;

  // Load the set of policy pubkeys owned by this wallet for filtering
  const ownedPolicies = await prisma.policy.findMany({
    where: { owner: walletPubkey },
    select: { pubkey: true },
  });
  const policySet = new Set(ownedPolicies.map((p) => p.pubkey));

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send initial keepalive
  res.write(":ok\n\n");

  // Create listeners for each event type, filtering by policy ownership
  const listeners = SSE_EVENTS.map((eventName) => {
    const handler = (data: unknown) => {
      // All SSE payloads include policyPubkey — only forward if owned by this wallet
      const payload = data as { policyPubkey?: string };
      if (payload.policyPubkey && !policySet.has(payload.policyPubkey)) return;

      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    sseEmitter.on(eventName, handler);
    return { eventName, handler };
  });

  // Clean up on client disconnect
  req.on("close", () => {
    for (const { eventName, handler } of listeners) {
      sseEmitter.off(eventName, handler);
    }
  });
});
