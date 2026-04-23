// GET /api/policies — all policies owned by the authenticated wallet.

import express from "express";
import { prisma } from "../../db/client.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const policiesRouter: express.Router = express.Router();

policiesRouter.get("/", async (req, res) => {
  try {
    const { walletPubkey } = req as AuthenticatedRequest;

    const policies = await prisma.policy.findMany({
      where: { owner: walletPubkey },
      orderBy: { createdAt: "desc" },
    });

    // Serialize bigint fields for JSON
    const serialized = policies.map((p) => ({
      ...p,
      maxTxLamports: p.maxTxLamports.toString(),
      dailyBudgetLamports: p.dailyBudgetLamports.toString(),
      escalationThreshold: p.escalationThreshold?.toString() ?? null,
    }));

    res.json({ policies: serialized });
  } catch (err) {
    console.error("[api/policies] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
