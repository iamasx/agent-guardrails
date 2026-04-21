# Guardrails Worker

Standalone Node.js 20 monitoring service. ESM (`"type": "module"`). Deployed to Fly.io.

## Pipeline

```
Helius webhook POST → index.ts
  → ingest.ts      HMAC verify, parse, persist to Supabase
  → prefilter.ts   Cheap stat checks (skip LLM if benign)
  → judge.ts       Claude Haiku API call → verdict
  → executor.ts    If pause: sign + send pause_agent on-chain
  → reporter.ts    Queue Opus incident report (async)
```

## Key files

- `src/index.ts` — HTTP server, entry point
- `src/ingest.ts` — HMAC + parse + Supabase insert
- `src/prefilter.ts` — statistical checks per section 5.2
- `src/judge.ts` — Claude Haiku integration per section 5.4
- `src/executor.ts` — on-chain pause per section 5.5
- `src/reporter.ts` — Opus reports per section 5.6
- `src/prompts/` — judge and incident-report prompt templates
- `src/types/` — db, events, anomaly types
- `src/sdk/` — **COPY of sdk/. Never edit directly.**

## Claude API

- Hot path: `claude-haiku-4-5-20251001`, max_tokens 256, target <2s latency
- Output: `{ verdict: "allow"|"flag"|"pause", confidence: 0-100, reasoning, signals }`
- On timeout (>3s): fall back to rule-based verdict
- Incident reports: `claude-opus-4-7`, async after pause
- Persist all verdicts to `anomaly_verdicts` with token counts + latency

## Commands

```bash
pnpm install    # Install deps
pnpm dev        # Start with tsx watch
pnpm build      # Compile to dist/
fly deploy      # Deploy to Fly.io
```

## Do NOT

- Edit anything in `src/sdk/` — edit `sdk/` at repo root and sync
- Include transaction memos in Claude prompt (prompt injection risk)
- Expose ANTHROPIC_API_KEY in logs or responses
- Use Supabase anon key — this service uses service role
- Block webhook handler on Opus report generation — must be async
