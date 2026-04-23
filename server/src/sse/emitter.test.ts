import { describe, it, expect, vi } from "vitest";
import { sseEmitter } from "./emitter.js";
import type { SSENewTransaction, SSEVerdict, SSEReportReady } from "../types/events.js";

// Minimal fixture payloads matching the SSE types.

const txnPayload: SSENewTransaction = {
  id: "txn-001",
  policyPubkey: "PolicyPub111111111111111111111111111111111111",
  txnSig: "5wHu1qwD7q4Hd...",
  slot: "280000000",
  blockTime: new Date("2025-06-01T12:00:00Z"),
  targetProgram: "11111111111111111111111111111111",
  amountLamports: "1000000",
  status: "executed",
  rejectReason: null,
  rawEvent: { some: "data" },
  createdAt: new Date("2025-06-01T12:00:01Z"),
};

const verdictPayload: SSEVerdict = {
  id: "verdict-001",
  txnId: "txn-001",
  policyPubkey: "PolicyPub111111111111111111111111111111111111",
  verdict: "allow",
  confidence: 0.95,
  reasoning: "Known program, low amount",
  model: "claude-haiku-4-5-20251001",
  latencyMs: 320,
  prefilterSkipped: false,
  promptTokens: 180,
  completionTokens: 42,
  createdAt: new Date("2025-06-01T12:00:02Z"),
  signals: [],
};

const reportPayload: SSEReportReady = {
  incidentId: "inc-001",
  policyPubkey: "PolicyPub111111111111111111111111111111111111",
  fullReport: "## Incident Report\nAgent drained 2 SOL...",
};

describe("SSEEmitter", () => {
  it("emitEvent delivers typed payload to onEvent listener", () => {
    const listener = vi.fn();
    sseEmitter.onEvent("new_transaction", listener);

    sseEmitter.emitEvent("new_transaction", txnPayload);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(txnPayload);

    sseEmitter.offEvent("new_transaction", listener);
  });

  it("offEvent removes listener so it no longer fires", () => {
    const listener = vi.fn();
    sseEmitter.onEvent("verdict", listener);
    sseEmitter.offEvent("verdict", listener);

    sseEmitter.emitEvent("verdict", verdictPayload);

    expect(listener).not.toHaveBeenCalled();
  });

  it("emitEvent returns false when no listeners registered", () => {
    // Use a specific event type with no listeners attached.
    // Remove all listeners for report_ready to ensure a clean state.
    sseEmitter.removeAllListeners("report_ready");

    const result = sseEmitter.emitEvent("report_ready", reportPayload);

    expect(result).toBe(false);
  });

  it("supports multiple listeners for the same event", () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    sseEmitter.onEvent("verdict", listenerA);
    sseEmitter.onEvent("verdict", listenerB);

    sseEmitter.emitEvent("verdict", verdictPayload);

    expect(listenerA).toHaveBeenCalledOnce();
    expect(listenerA).toHaveBeenCalledWith(verdictPayload);
    expect(listenerB).toHaveBeenCalledOnce();
    expect(listenerB).toHaveBeenCalledWith(verdictPayload);

    sseEmitter.offEvent("verdict", listenerA);
    sseEmitter.offEvent("verdict", listenerB);
  });

  it("different event types don't cross-fire", () => {
    const txnListener = vi.fn();
    const verdictListener = vi.fn();

    sseEmitter.onEvent("new_transaction", txnListener);
    sseEmitter.onEvent("verdict", verdictListener);

    sseEmitter.emitEvent("new_transaction", txnPayload);

    expect(txnListener).toHaveBeenCalledOnce();
    expect(verdictListener).not.toHaveBeenCalled();

    sseEmitter.offEvent("new_transaction", txnListener);
    sseEmitter.offEvent("verdict", verdictListener);
  });

  it("maxListeners is set to 100", () => {
    expect(sseEmitter.getMaxListeners()).toBe(100);
  });
});
