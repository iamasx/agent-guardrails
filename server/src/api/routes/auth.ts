// SIWS (Sign In With Solana) authentication routes.
// POST /auth/siws/nonce — generate nonce + message
// POST /auth/siws/verify — verify Ed25519 signature, issue JWT, set httpOnly cookie

import { randomBytes } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import { prisma } from "../../db/client.js";
import { env } from "../../config/env.js";

export const authRouter: express.Router = express.Router();

const JWT_EXPIRY = "24h";
const NONCE_EXPIRY_MINUTES = 10;

// ---------------------------------------------------------------------------
// POST /auth/siws/nonce
// ---------------------------------------------------------------------------

authRouter.post("/siws/nonce", async (req, res) => {
  try {
    const { pubkey } = req.body as { pubkey?: string };

    if (!pubkey || typeof pubkey !== "string") {
      res.status(400).json({ error: "pubkey is required" });
      return;
    }

    const nonce = randomBytes(32).toString("base64");
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60_000);

    await prisma.authSession.create({
      data: {
        walletPubkey: pubkey,
        nonce,
        expiresAt,
      },
    });

    const message = `Sign this message to authenticate with Agent Guardrails.\n\nWallet: ${pubkey}\nNonce: ${nonce}`;

    res.json({ nonce, message });
  } catch (err) {
    console.error("[auth/nonce] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/siws/verify
// ---------------------------------------------------------------------------

authRouter.post("/siws/verify", async (req, res) => {
  try {
    const { pubkey, signature, message } = req.body as {
      pubkey?: string;
      signature?: string;
      message?: string;
    };

    if (!pubkey || !signature || !message) {
      res.status(400).json({ error: "pubkey, signature, and message are required" });
      return;
    }

    // Extract nonce from the message
    const nonceMatch = message.match(/Nonce: (.+)$/m);
    if (!nonceMatch) {
      res.status(400).json({ error: "Invalid message format" });
      return;
    }
    const nonce = nonceMatch[1];

    // Find the auth session
    const session = await prisma.authSession.findFirst({
      where: {
        walletPubkey: pubkey,
        nonce,
        signedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      res.status(401).json({ error: "Invalid or expired nonce" });
      return;
    }

    // Verify Ed25519 signature
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, "base64");
    const pubkeyBytes = Buffer.from(pubkey, "base64");

    // Try base58 decode for Solana pubkeys (32 bytes)
    let pubkeyBuffer: Uint8Array;
    if (pubkeyBytes.length === 32) {
      pubkeyBuffer = pubkeyBytes;
    } else {
      // Assume base58-encoded Solana pubkey — decode manually
      pubkeyBuffer = decodeBase58(pubkey);
    }

    const valid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubkeyBuffer,
    );

    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Mark session as signed
    await prisma.authSession.update({
      where: { id: session.id },
      data: { signedAt: new Date() },
    });

    // Issue JWT
    const token = jwt.sign({ walletPubkey: pubkey }, env.JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });

    // Set httpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[auth/verify] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Base58 decoder (for Solana pubkeys)
// ---------------------------------------------------------------------------

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading zeros
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}
