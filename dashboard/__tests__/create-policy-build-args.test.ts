import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  buildInitializePolicyArgs,
  parseAuthorizedMonitorsFromEnv,
} from "@/lib/create-policy/build-args";
import type { CreatePolicyDraftInput } from "@/lib/create-policy/validate";

const systemProgram = PublicKey.default.toBase58();

const baseDraft: CreatePolicyDraftInput = {
  allowedPrograms: [systemProgram],
  maxTxSol: 1,
  dailyBudgetSol: 2,
  sessionDays: 7,
  escalationEnabled: false,
  squadsMultisig: "",
  escalationThresholdSol: 0,
};

describe("buildInitializePolicyArgs", () => {
  it("maps SOL to lamports and mirrors max tx lamports into maxTxTokenUnits", () => {
    const args = buildInitializePolicyArgs(baseDraft);
    expect(args.maxTxLamports.toNumber()).toBe(1 * LAMPORTS_PER_SOL);
    expect(args.maxTxTokenUnits.eq(args.maxTxLamports)).toBe(true);
    expect(args.dailyBudgetLamports.toNumber()).toBe(2 * LAMPORTS_PER_SOL);
  });

  it("sets session expiry in the future (unix seconds)", () => {
    const before = Math.floor(Date.now() / 1000);
    const args = buildInitializePolicyArgs(baseDraft);
    const after = Math.floor(Date.now() / 1000) + 7 * 86_400;
    const ts = args.sessionExpiry.toNumber();
    expect(ts).toBeGreaterThanOrEqual(before + 6 * 86_400);
    expect(ts).toBeLessThanOrEqual(after + 2);
  });
});

describe("parseAuthorizedMonitorsFromEnv", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.NEXT_PUBLIC_MONITOR_PUBKEY;
    delete process.env.NEXT_PUBLIC_AUTHORIZED_MONITORS;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("returns empty list when env unset", () => {
    expect(parseAuthorizedMonitorsFromEnv()).toEqual([]);
  });

  it("parses comma-separated pubkeys and skips invalid entries", () => {
    const a = Keypair.generate().publicKey;
    const b = Keypair.generate().publicKey;
    process.env.NEXT_PUBLIC_MONITOR_PUBKEY = `${a.toBase58()}, not-a-key, ${b.toBase58()}`;
    const got = parseAuthorizedMonitorsFromEnv();
    expect(got).toHaveLength(2);
    expect(got[0]!.toBase58()).toBe(a.toBase58());
    expect(got[1]!.toBase58()).toBe(b.toBase58());
  });

  it("caps at 3 monitors", () => {
    const keys = [Keypair.generate(), Keypair.generate(), Keypair.generate(), Keypair.generate()].map(
      (k) => k.publicKey.toBase58(),
    );
    process.env.NEXT_PUBLIC_MONITOR_PUBKEY = keys.join(",");
    expect(parseAuthorizedMonitorsFromEnv()).toHaveLength(3);
  });
});
