import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeHeliusTxn } from "../../__tests__/fixtures/helius-txn.js";
import { makePolicy, makeGuardedTxn } from "../../__tests__/fixtures/prisma-rows.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  policy: { findUnique: vi.fn() },
  guardedTxn: { upsert: vi.fn() },
};
vi.mock("../../db/client.js", () => ({ prisma: mockPrisma }));

const mockEmitter = { emitEvent: vi.fn() };
vi.mock("../../sse/emitter.js", () => ({ sseEmitter: mockEmitter }));

vi.mock("../../config/env.js", () => ({
  env: { GUARDRAILS_PROGRAM_ID: "TestProgramId11111111111111111111" },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks are registered)
// ---------------------------------------------------------------------------

const { ingest } = await import("./ingest.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ingest", () => {
  // =========================================================================
  // Field extraction via ingest()
  // =========================================================================

  describe("field extraction via ingest()", () => {
    it("extracts policy pubkey from first account of guardrails instruction", async () => {
      const txn = makeHeliusTxn({
        instructions: [
          {
            programId: "TestProgramId11111111111111111111",
            accounts: ["MyPolicyPda1111111111111111111111", "Agent111"],
            data: "",
            innerInstructions: [],
          },
        ],
      });

      const policy = makePolicy({ pubkey: "MyPolicyPda1111111111111111111111" });
      mockPrisma.policy.findUnique.mockResolvedValue(policy);

      const row = makeGuardedTxn({ policyPubkey: "MyPolicyPda1111111111111111111111" });
      mockPrisma.guardedTxn.upsert.mockResolvedValue(row);

      await ingest(txn);

      expect(mockPrisma.policy.findUnique).toHaveBeenCalledWith({
        where: { pubkey: "MyPolicyPda1111111111111111111111" },
      });
    });

    it("returns null when no instruction matches GUARDRAILS_PROGRAM_ID", async () => {
      const txn = makeHeliusTxn({
        instructions: [
          {
            programId: "SomeOtherProgramId1111111111111111",
            accounts: ["Account1"],
            data: "",
            innerInstructions: [],
          },
        ],
      });

      const result = await ingest(txn);

      expect(result).toBeNull();
      expect(mockPrisma.policy.findUnique).not.toHaveBeenCalled();
    });

    it("extracts target program from CPI inner instructions", async () => {
      const txn = makeHeliusTxn({
        instructions: [
          {
            programId: "TestProgramId11111111111111111111",
            accounts: ["PolicyPda1111111111111111111111111"],
            data: "",
            innerInstructions: [
              {
                programId: "InnerTarget11111111111111111111111",
                accounts: [],
                data: "",
              },
            ],
          },
        ],
      });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);

      const row = makeGuardedTxn({ targetProgram: "InnerTarget11111111111111111111111" });
      mockPrisma.guardedTxn.upsert.mockResolvedValue(row);

      await ingest(txn);

      // The create call in upsert should use InnerTarget as targetProgram
      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      expect(upsertCall.create.targetProgram).toBe("InnerTarget11111111111111111111111");
    });

    it("falls back to txn.type when no inner instructions exist", async () => {
      const txn = makeHeliusTxn({
        type: "TOKEN_MINT",
        instructions: [
          {
            programId: "TestProgramId11111111111111111111",
            accounts: ["PolicyPda1111111111111111111111111"],
            data: "",
            innerInstructions: [],
          },
        ],
      });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);

      const row = makeGuardedTxn({ targetProgram: "TOKEN_MINT" });
      mockPrisma.guardedTxn.upsert.mockResolvedValue(row);

      await ingest(txn);

      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      expect(upsertCall.create.targetProgram).toBe("TOKEN_MINT");
    });

    it("sums native transfers from fee payer as amountLamports", async () => {
      const txn = makeHeliusTxn({
        feePayer: "AgentPubkey11111111111111111111111",
        nativeTransfers: [
          { fromUserAccount: "AgentPubkey11111111111111111111111", toUserAccount: "Dest1", amount: 50_000_000 },
          { fromUserAccount: "AgentPubkey11111111111111111111111", toUserAccount: "Dest2", amount: 30_000_000 },
          { fromUserAccount: "SomeoneElse111111111111111111111", toUserAccount: "Dest3", amount: 999 },
        ],
      });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);
      mockPrisma.guardedTxn.upsert.mockResolvedValue(makeGuardedTxn());

      await ingest(txn);

      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      expect(upsertCall.create.amountLamports).toBe(BigInt(80_000_000));
    });

    it("returns null amountLamports when no native transfers", async () => {
      const txn = makeHeliusTxn({
        nativeTransfers: [],
      });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);
      mockPrisma.guardedTxn.upsert.mockResolvedValue(makeGuardedTxn({ amountLamports: null }));

      await ingest(txn);

      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      expect(upsertCall.create.amountLamports).toBeNull();
    });

    it("returns status=executed when no transactionError", async () => {
      const txn = makeHeliusTxn({ transactionError: null });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);
      mockPrisma.guardedTxn.upsert.mockResolvedValue(makeGuardedTxn());

      await ingest(txn);

      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      expect(upsertCall.create.status).toBe("executed");
      expect(upsertCall.create.rejectReason).toBeNull();
    });

    it("maps rejection reason codes to named reasons", async () => {
      const txn = makeHeliusTxn({
        transactionError: "SessionExpired",
      });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);
      mockPrisma.guardedTxn.upsert.mockResolvedValue(makeGuardedTxn({ status: "rejected" }));

      await ingest(txn);

      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      expect(upsertCall.create.status).toBe("rejected");
      expect(upsertCall.create.rejectReason).toBe("SessionExpired");
    });

    it("truncates unknown error strings to 256 chars", async () => {
      const longError = "x".repeat(500);
      const txn = makeHeliusTxn({ transactionError: longError });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);
      mockPrisma.guardedTxn.upsert.mockResolvedValue(makeGuardedTxn({ status: "rejected" }));

      await ingest(txn);

      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      expect(upsertCall.create.rejectReason).toHaveLength(256);
    });
  });

  // =========================================================================
  // ingest() database + SSE
  // =========================================================================

  describe("ingest() database + SSE", () => {
    it("returns null and warns when no policy pubkey found", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const txn = makeHeliusTxn({
        instructions: [
          {
            programId: "UnrelatedProgram111111111111111111",
            accounts: [],
            data: "",
            innerInstructions: [],
          },
        ],
      });

      const result = await ingest(txn);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no policy found"));

      warnSpy.mockRestore();
    });

    it("returns null when policy not in database", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const txn = makeHeliusTxn();
      mockPrisma.policy.findUnique.mockResolvedValue(null);

      const result = await ingest(txn);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown policy"));

      warnSpy.mockRestore();
    });

    it("upserts GuardedTxn with correct fields", async () => {
      const txn = makeHeliusTxn({ signature: "sig123abc" });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);

      const row = makeGuardedTxn({ txnSig: "sig123abc" });
      mockPrisma.guardedTxn.upsert.mockResolvedValue(row);

      await ingest(txn);

      expect(mockPrisma.guardedTxn.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { txnSig: "sig123abc" },
          update: {},
          create: expect.objectContaining({
            txnSig: "sig123abc",
            policyPubkey: "PolicyPda1111111111111111111111111",
            status: "executed",
          }),
        }),
      );
    });

    it("converts slot to BigInt and timestamp*1000 to Date", async () => {
      const txn = makeHeliusTxn({ slot: 999888, timestamp: 1700000000 });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);
      mockPrisma.guardedTxn.upsert.mockResolvedValue(makeGuardedTxn());

      await ingest(txn);

      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      expect(upsertCall.create.slot).toBe(BigInt(999888));
      expect(upsertCall.create.blockTime).toEqual(new Date(1700000000 * 1000));
    });

    it("handles duplicate txns via upsert (no error)", async () => {
      const txn = makeHeliusTxn({ signature: "dup-sig" });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);

      const existingRow = makeGuardedTxn({ txnSig: "dup-sig" });
      mockPrisma.guardedTxn.upsert.mockResolvedValue(existingRow);

      // Should not throw
      const result = await ingest(txn);
      expect(result).toEqual(existingRow);
      // Upsert was called with update: {} so duplicates are handled
      expect(mockPrisma.guardedTxn.upsert.mock.calls[0][0].update).toEqual({});
    });

    it("emits new_transaction SSE with stringified bigints", async () => {
      const txn = makeHeliusTxn();

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);

      const row = makeGuardedTxn({
        slot: BigInt(555),
        amountLamports: BigInt(100_000_000),
      });
      mockPrisma.guardedTxn.upsert.mockResolvedValue(row);

      await ingest(txn);

      expect(mockEmitter.emitEvent).toHaveBeenCalledWith(
        "new_transaction",
        expect.objectContaining({
          slot: "555",
          amountLamports: "100000000",
        }),
      );
    });

    it("returns the created GuardedTxn row", async () => {
      const txn = makeHeliusTxn();

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);

      const row = makeGuardedTxn({ id: "row-id-42" });
      mockPrisma.guardedTxn.upsert.mockResolvedValue(row);

      const result = await ingest(txn);

      expect(result).toBe(row);
      expect(result!.id).toBe("row-id-42");
    });

    it("stores raw event as JSON", async () => {
      const txn = makeHeliusTxn({ signature: "raw-test" });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);
      mockPrisma.guardedTxn.upsert.mockResolvedValue(makeGuardedTxn());

      await ingest(txn);

      const upsertCall = mockPrisma.guardedTxn.upsert.mock.calls[0][0];
      // rawEvent should be a serialized-then-parsed copy (JSON round-trip strips non-JSON values)
      expect(upsertCall.create.rawEvent).toBeDefined();
      expect(upsertCall.create.rawEvent.signature).toBe("raw-test");
    });

    it("handles null amountLamports correctly", async () => {
      const txn = makeHeliusTxn({ nativeTransfers: [] });

      const policy = makePolicy();
      mockPrisma.policy.findUnique.mockResolvedValue(policy);

      const row = makeGuardedTxn({ amountLamports: null });
      mockPrisma.guardedTxn.upsert.mockResolvedValue(row);

      await ingest(txn);

      // SSE event should have null for amountLamports
      expect(mockEmitter.emitEvent).toHaveBeenCalledWith(
        "new_transaction",
        expect.objectContaining({
          amountLamports: null,
        }),
      );
    });
  });
});
