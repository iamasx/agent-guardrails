// In-memory event bus bridging the worker pipeline and SSE route.
// Worker stages emit events here; the SSE route subscribes and streams to clients.

import { EventEmitter } from "node:events";
import type {
  SSENewTransaction,
  SSEVerdict,
  SSEAgentPaused,
  SSEReportReady,
} from "../types/events.js";

/** Map of SSE event names to their payload types. */
export interface SSEEventMap {
  new_transaction: SSENewTransaction;
  verdict: SSEVerdict;
  agent_paused: SSEAgentPaused;
  report_ready: SSEReportReady;
}

export type SSEEventName = keyof SSEEventMap;

/**
 * Typed wrapper around Node EventEmitter for SSE events.
 * Provides type-safe emit/on/off while remaining a plain EventEmitter
 * so the SSE route can use standard listener patterns.
 */
class SSEEmitter extends EventEmitter {
  emitEvent<K extends SSEEventName>(event: K, data: SSEEventMap[K]): boolean {
    return this.emit(event, data);
  }

  onEvent<K extends SSEEventName>(
    event: K,
    listener: (data: SSEEventMap[K]) => void,
  ): this {
    return this.on(event, listener as (...args: unknown[]) => void);
  }

  offEvent<K extends SSEEventName>(
    event: K,
    listener: (data: SSEEventMap[K]) => void,
  ): this {
    return this.off(event, listener as (...args: unknown[]) => void);
  }
}

/** Singleton SSE emitter shared between worker pipeline and API module. */
export const sseEmitter = new SSEEmitter();

// Allow many concurrent SSE clients without Node warning.
sseEmitter.setMaxListeners(100);
