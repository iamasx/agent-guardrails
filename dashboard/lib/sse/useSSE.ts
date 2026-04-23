// TODO: SSE hook for realtime updates
// - EventSource connection to server GET /api/events (withCredentials: true)
// - Listen for: new_transaction, verdict, agent_paused, report_ready
// - Parse full payload from each event (JSON in e.data)
// - Insert directly into TanStack Query cache via setQueryData (no refetch)
// - Update BOTH global and policy-filtered caches:
//
//   new_transaction:
//     - prepend to ["transactions"] (global)
//     - prepend to ["transactions", txn.policyPubkey] (if cached)
//
//   verdict:
//     - patch matching txn in ["transactions"] (global)
//     - patch matching txn in ["transactions", verdict.policyPubkey] (if cached)
//
//   agent_paused:
//     - prepend to ["incidents"] (global)
//     - prepend to ["incidents", incident.policyPubkey] (if cached)
//     - mark isActive=false in ["policies"] (global)
//     - mark isActive=false in ["policy", incident.policyPubkey] (if cached)
//
//   report_ready:
//     - patch fullReport in ["incidents"] (global)
//     - patch fullReport in ["incidents", policyPubkey] (if cached)
//
// Use updateIfExists helper — only update caches that already exist,
// don't create empty caches for pages the user hasn't visited.
//
// Query key convention:
//   ["transactions"]                — global (activity page)
//   ["transactions", policyPubkey]  — filtered (agent detail)
//   ["incidents"]                   — global (incidents page)
//   ["incidents", policyPubkey]     — filtered (agent detail)
//   ["policies"]                    — all user's policies (agents list)
//   ["policy", pubkey]              — single on-chain policy (agent detail)

"use client";

import { useEffect } from "react";

// Phase 2-safe stub. Full event handling lands in Phase 3.
export function useSSE(): void {
  useEffect(() => {
    return () => {
      // no-op cleanup
    };
  }, []);
}
