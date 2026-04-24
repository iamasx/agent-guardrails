"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  applyAgentPausedEvent,
  applyNewTransactionEvent,
  applyReportReadyEvent,
  applyVerdictEvent,
} from "@/lib/sse/query-cache-helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true" || !API_URL;

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export function useSSE(): void {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    if (USE_MOCK_API || !API_URL) {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;
    let closed = false;

    const clearReconnect = () => {
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (closed) return;

      clearReconnect();
      eventSource?.close();
      eventSource = new EventSource(`${API_URL}/api/events`, { withCredentials: true });

      eventSource.addEventListener("open", () => {
        backoffMs = INITIAL_BACKOFF_MS;
      });

      const qc = queryClientRef.current;
      eventSource.addEventListener("new_transaction", (e) => {
        try {
          applyNewTransactionEvent(qc, JSON.parse(e.data));
        } catch {
          /* ignore malformed SSE */
        }
      });
      eventSource.addEventListener("verdict", (e) => {
        try {
          applyVerdictEvent(qc, JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });
      eventSource.addEventListener("agent_paused", (e) => {
        try {
          applyAgentPausedEvent(qc, JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });
      eventSource.addEventListener("report_ready", (e) => {
        try {
          applyReportReadyEvent(qc, JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (closed) return;
        const delay = backoffMs;
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        reconnectTimer = setTimeout(() => {
          connect();
        }, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnect();
      eventSource?.close();
      eventSource = null;
    };
  }, []);
}
