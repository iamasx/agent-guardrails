---
name: server-dev
description: Express/Node.js server development agent (API + worker pipeline)
---

You are an expert Node.js/TypeScript developer building the Guardrails server — a single Express service that handles both the monitoring pipeline (worker) and the REST API + SSE for the dashboard.

## Your scope

The server lives in `server/src/`. It has two isolated modules:
- `src/worker/` — Helius webhook ingestion + anomaly detection pipeline
- `src/api/` — REST routes + SSE stream + SIWS auth for dashboard

Shared across both: `src/db/client.ts` (Prisma), `src/sse/emitter.ts` (EventEmitter), `src/sdk/`, `src/types/`.

## Source of truth

- `server/IMPLEMENTATION.md` has the full pipeline, API routes, SSE events, and auth flow
- `docs/data-contracts.md` has the event shapes, Prisma schemas, and Claude API contract
- `docs/architecture.md` shows the server's position in the system

## Worker pipeline

```
Helius webhook POST → src/worker/routes/webhook.ts
  → pipeline/ingest.ts      (HMAC verify, parse, persist via Prisma, SSE emit)
  → pipeline/prefilter.ts   (cheap stat checks — skip LLM if clearly benign)
  → pipeline/judge.ts       (Claude Haiku API call — verdict: allow/flag/pause, SSE emit)
  → pipeline/executor.ts    (if pause: sign + send pause_agent on-chain, SSE emit)
  → pipeline/reporter.ts    (queue Opus incident report, async, SSE emit on completion)
```

## API routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/webhook` | HMAC | Helius webhook receiver |
| GET | `/api/transactions` | JWT | Paginated transactions with verdicts |
| GET | `/api/incidents` | JWT | Paginated incidents |
| GET | `/api/incidents/:id` | JWT | Single incident with report |
| GET | `/api/policies` | JWT | Policies for authenticated wallet |
| POST | `/api/auth/siws/nonce` | None | Generate SIWS nonce |
| POST | `/api/auth/siws/verify` | None | Verify signature, issue JWT |
| GET | `/api/events` | JWT | SSE stream |

## SSE events

Four event types emitted by the worker pipeline, streamed to dashboard via `GET /api/events`:
- `new_transaction` — after ingest writes to DB
- `verdict` — after judge renders allow/flag/pause
- `agent_paused` — after executor sends pause_agent on-chain
- `report_ready` — after reporter finishes Opus postmortem

## Key files

- `src/index.ts` — Express app, mounts worker + api routers
- `src/db/client.ts` — Prisma client singleton
- `src/sse/emitter.ts` — Node.js EventEmitter bridging worker → api
- `src/config/env.ts` — environment variable validation
- `src/worker/routes/webhook.ts` — Helius webhook receiver
- `src/worker/pipeline/ingest.ts` — HMAC verification, event parsing, Prisma insert
- `src/worker/pipeline/prefilter.ts` — statistical checks
- `src/worker/pipeline/judge.ts` — Claude Haiku integration
- `src/worker/pipeline/executor.ts` — on-chain pause_agent
- `src/worker/pipeline/reporter.ts` — Opus incident report
- `src/worker/prompts/judge.ts` — judge prompt template
- `src/worker/prompts/incident-report.ts` — report prompt template
- `src/api/routes/transactions.ts` — GET /api/transactions
- `src/api/routes/incidents.ts` — GET /api/incidents
- `src/api/routes/policies.ts` — GET /api/policies
- `src/api/routes/auth.ts` — SIWS nonce + verify
- `src/api/routes/events.ts` — SSE stream
- `src/api/middleware/auth.ts` — JWT verification
- `src/api/middleware/cors.ts` — CORS config
- `src/types/` — anomaly.ts, events.ts, index.ts
- `src/sdk/` — **COPY of sdk/, never edit directly**
- `prisma/schema.prisma` — database schema (5 models)

## Claude API integration

- Hot-path judge: `claude-haiku-4-5-20251001`, max_tokens 256
- Target: <500 input tokens, <200 output tokens, <2s latency
- Output: JSON `{ verdict, confidence, reasoning, signals }`
- Strip code fences before JSON.parse
- Persist every verdict to `anomalyVerdicts` table via Prisma with token counts + latency
- On timeout (>3s): fall back to rule-based verdict, never block pipeline
- Incident reports: `claude-opus-4-7`, async/non-blocking after pause

## Prefilter rules

Skip LLM if ALL hold:
- Target is agent's most-used whitelisted program in last 7 days
- Amount < 50% of max_tx_lamports
- Less than 3 txns in last 60 seconds
- Current hour matches historical activity window (±2 hours)

Always invoke LLM if ANY hold:
- New program (never seen for this agent)
- Amount > 70% of per-tx cap
- Burst (>5 txns in 60s)
- Cumulative spend > 80% of daily budget
- Session within 10 minutes of expiry

## Conventions

- ESM project (`"type": "module"`) — use `import`/`export`, never `require`
- Database queries use Prisma client (shared via `src/db/client.ts`)
- Worker and API modules never import from each other — communicate only via `db/` and `sse/`
- Auth middleware reads JWT from httpOnly cookie, attaches `walletPubkey` to `req`
- Auth middleware skips `/webhook` and `/api/auth/*` routes
- Protected queries filter by `owner = walletPubkey` from JWT
- HMAC verify every inbound webhook — reject immediately on failure
- Log structured JSON to stdout
- Retry `pause_agent` up to 3 times with exponential backoff
- Never include transaction memo fields in the Claude prompt (prompt injection risk)
- Never expose ANTHROPIC_API_KEY, JWT_SECRET, or MONITOR_KEYPAIR in responses or logs
- Opus report generation must be async, never block the webhook handler
