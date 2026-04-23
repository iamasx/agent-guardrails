# Dashboard Phases

## Status

| Phase | Name | Status |
|---|---|---|
| 1 | App Shell and Static Screens | Complete |
| 2 | Frontend Data Layer and Query State | Pending |
| 3 | Server API, Auth, and Realtime | Pending |
| 4 | Policy Create/Edit and Agent Actions | Pending |
| 5 | Hardening, Edge Cases, and Demo Quality | Pending |

## Scope and Artifacts

- `dashboard/` is the authoritative implementation target (Next.js 14 App Router).
- Root `index.html` is a **prototype/reference artifact for UI design only** and is not the production architecture source of truth.
- This phase plan tracks implementation progress against `dashboard/IMPLEMENTATION.md`.

## Phase 1 — App Shell and Static Screens

Status: Complete

Delivered:
- Shared dashboard shell with sidebar, topbar, wallet controls, and global styling.
- Core routes implemented with mock-backed UI:
  - `/`
  - `/signin`
  - `/agents`
  - `/agents/new`
  - `/agents/[pubkey]`
  - `/agents/[pubkey]/policy`
  - `/activity`
  - `/incidents`
  - `/incidents/[id]`
- Reusable presentation components for policy cards, spend gauge, transaction rows, incidents, and timeline views.
- Mock-backed dashboard data/types so screens render without backend integration.

Validation:
- `npx tsc --noEmit` passes in `dashboard/`.
- `npm test` passes in `dashboard/` (Phase 1 route/component + mock data coverage).
- `npm run build` passes in `dashboard/` (with a non-blocking WalletConnect transitive warning: `pino-pretty` optional resolution).

## Phase 2 — Frontend Data Layer and Query State

Status: Pending

Goal:
- Replace mock-only assumptions with stable query-backed state and finalized typed API client behavior.

Definition of Done:
- Typed API client in `lib/api/client.ts` finalized for:
  - policies list
  - transactions (global + policy-filtered)
  - incidents list + incident detail
- All API calls consistently use `credentials: "include"` and normalized error handling.
- TanStack Query keys standardized and documented in code:
  - `["transactions"]`
  - `["transactions", policyPubkey]`
  - `["incidents"]`
  - `["incidents", policyPubkey]`
  - `["policies"]`
  - `["policy", pubkey]`
- Zustand stores scoped by concern in `lib/stores/` (UI state vs filters/state).
- Route data flows migrated from fixtures to queries where server data exists; fixtures remain only as explicit fallback/dev mode.

Validation:
- Route-level smoke checks pass for `/agents`, `/agents/[pubkey]`, `/activity`, `/incidents`, `/incidents/[id]`.
- Manual verification that cache keys are consistent across fetch + mutation + SSE update points.
- `npx tsc --noEmit` passes in `dashboard/`.

Dependencies:
- Unblocks Phase 3 live data wiring.

## Phase 3 — Server API, Auth, and Realtime

Status: Pending

Goal:
- Complete SIWS auth integration and live realtime updates from server into dashboard state.

Definition of Done:
- SIWS flow works end-to-end from dashboard:
  1. nonce/message fetch
  2. wallet message signature
  3. verify call
  4. httpOnly auth cookie established
- Authenticated dashboard fetches succeed via cookie (`credentials: "include"`).
- Single SSE connection established at app/provider level.
- SSE events handled and patched into query caches:
  - `new_transaction`
  - `verdict`
  - `agent_paused`
  - `report_ready`
- Dashboard reads are live-backed (not fixture-only) for activity/incidents/policies where endpoints are available.

Validation:
- Manual test script confirms SIWS login/logout behavior with owner wallet.
- SSE simulation/manual test confirms each event updates expected query caches without full-page reload.
- `npx tsc --noEmit` passes in `dashboard/`.

Dependencies:
- Requires Phase 2 query architecture to be stable.

## Phase 4 — Policy Create/Edit and Agent Actions

Status: Pending

Goal:
- Complete write-path UX and on-chain action wiring for policy lifecycle and owner controls.

Definition of Done:
- `/agents/new` `CreatePolicyWizard` complete with 4-step flow:
  - Programs
  - Limits
  - Session
  - Escalation
- Validation rules implemented (including daily budget >= max tx; bounds checks; optional escalation fields).
- Submit path signs and sends `initialize_policy`, then routes to new agent detail page.
- `/agents/[pubkey]/policy` edit flow wired to on-chain/update actions.
- Kill switch / pause action:
  - visible only when active
  - reason required
  - wallet ownership checks
  - success/error toasts
  - query cache updates (`isActive: false`) after success
- Post-write cache invalidation/refresh strategy consistent and verified.

Validation:
- Manual happy-path + invalid-input tests for create/edit/pause.
- Owner/non-owner wallet behavior verified for action gating.
- `npx tsc --noEmit` passes in `dashboard/`.

Dependencies:
- Requires Phases 2–3 for stable reads/auth/event context.

## Phase 5 — Hardening, Edge Cases, and Demo Quality

Status: Pending

Goal:
- Production-quality UX and robust handling of edge/error states across all key flows.

Definition of Done:
- Loading, empty, and failure states implemented for all primary pages/components.
- Realtime feed memory bounds and pagination behavior verified (e.g., item cap + “load more”).
- Responsive polish completed for common viewport sizes.
- Incident detail/report rendering polished (markdown/report sections readable and stable).
- End-to-end demo flow validated:
  - sign in
  - view agents/activity
  - create/edit policy
  - observe realtime updates
  - pause flow
  - incidents/report inspection

Validation:
- End-to-end demo checklist passes.
- Build + typecheck pass in target environment.
- Known issues list resolved or explicitly documented with owner and follow-up plan.

## Risks and Tracking Notes

- Node runtime mismatch (`18.16.0` vs Next.js `>=18.17.0`) must be resolved before final build validation.
- Any divergence between prototype visuals (`index.html`) and implementation (`dashboard/`) should be tracked as explicit UX tasks, not architecture blockers.