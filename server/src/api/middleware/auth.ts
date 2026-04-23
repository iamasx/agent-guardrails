// JWT authentication middleware.
// Reads JWT from httpOnly cookie, verifies with JWT_SECRET,
// attaches walletPubkey to the request object.

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

/** Extended Request type with walletPubkey from JWT. */
export interface AuthenticatedRequest extends Request {
  walletPubkey: string;
}

interface JWTPayload {
  walletPubkey: string;
}

/**
 * JWT auth middleware. Skips auth for /auth/* routes.
 * Reads token from httpOnly cookie "token" or Authorization bearer header.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for SIWS auth routes and webhook
  if (req.path === "/webhook" || req.path.startsWith("/auth/")) {
    next();
    return;
  }

  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    (req as AuthenticatedRequest).walletPubkey = payload.walletPubkey;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
