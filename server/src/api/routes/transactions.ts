// GET /api/transactions — paginated guarded transactions with verdicts.
// Filtered to policies owned by the authenticated wallet.

import express from "express";
import { prisma } from "../../db/client.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const transactionsRouter: express.Router = express.Router();

transactionsRouter.get("/", async (req, res) => {
  try {
    const { walletPubkey } = req as AuthenticatedRequest;

    const rawLimit = Number.parseInt(req.query.limit as string, 10);
    const rawOffset = Number.parseInt(req.query.offset as string, 10);
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);
    const policyFilter = req.query.policy as string | undefined;

    // Find policies owned by this wallet
    const ownedPolicies = await prisma.policy.findMany({
      where: { owner: walletPubkey },
      select: { pubkey: true },
    });
    const policyPubkeys = ownedPolicies.map((p) => p.pubkey);

    if (policyPubkeys.length === 0) {
      res.json({ transactions: [], total: 0 });
      return;
    }

    // Apply optional policy filter
    const policyWhere = policyFilter && policyPubkeys.includes(policyFilter)
      ? policyFilter
      : undefined;

    const where = {
      policyPubkey: policyWhere ? policyWhere : { in: policyPubkeys },
    };

    const [transactions, total] = await Promise.all([
      prisma.guardedTxn.findMany({
        where,
        include: { verdict: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.guardedTxn.count({ where }),
    ]);

    // Serialize bigint fields for JSON
    const serialized = transactions.map((t) => ({
      ...t,
      slot: t.slot.toString(),
      amountLamports: t.amountLamports?.toString() ?? null,
    }));

    res.json({ transactions: serialized, total });
  } catch (err) {
    console.error("[api/transactions] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
