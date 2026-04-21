# Agent Guardrails Protocol

Solana Frontier hackathon project. On-chain policy layer between AI agents and the blockchain — enforces allow-lists, spending budgets, and real-time kill switches.

## Repository structure

Four isolated sub-projects — NOT a monorepo with workspaces:

- `program/` — Anchor 0.30.1 / Rust Solana program
- `worker/` — Node.js monitoring service (Fly.io)
- `dashboard/` — Next.js 14 app + demo agents (Vercel)
- `sdk/` — Source of truth for IDL + TS client (synced to consumers)

Each project has its own `package.json` and installs its own dependencies. There is no root `package.json` or `pnpm-workspace.yaml`.

## SDK sync (critical)

`sdk/` is the SOLE source of truth. `worker/src/sdk/` and `dashboard/lib/sdk/` are COPIES.

- **Never edit** files inside `worker/src/sdk/` or `dashboard/lib/sdk/`
- **Always edit** `sdk/` then run `bash scripts/sync-sdk.sh`
- The pre-commit hook auto-syncs when `sdk/` or `program/` files are staged
- CI fails if copies are out of sync
- After `anchor build`, the IDL at `program/target/idl/guardrails.json` is copied to `sdk/idl/` by the sync script

Configure hooks after clone: `git config core.hooksPath .githooks`

## Reference documents

- `implementation-plan.md` — Full specification. Section numbers in TODO comments refer to this.
- `docs/architecture.md` — System topology and data flow diagrams
- `docs/data-contracts.md` — Account layouts, event shapes, Supabase schemas, Claude API contract
- `docs/env-setup.md` — Local development setup guide
- `docs/deploy.md` — Deployment guide (program → worker → dashboard)
- `docs/demo-runbook.md` — Demo day operator's guide

## Common commands

```bash
# Program
cd program && anchor build            # Build Anchor program
cd program && anchor test             # Run tests (starts local validator)

# SDK sync
bash scripts/sync-sdk.sh              # Sync after any sdk/ or program change

# Worker
cd worker && pnpm install && pnpm dev # Start worker locally

# Dashboard
cd dashboard && npm install && npm run dev  # Start dashboard locally

# Demo
cd dashboard && npm run demo:setup     # Create demo policy on devnet
cd dashboard && npm run demo:simulate  # Run the attack simulation
```

## Environment variables

Never commit `.env` files. See `worker/.env.example` and `dashboard/.env.example`.

- Worker needs: `SOLANA_RPC_URL`, `GUARDRAILS_PROGRAM_ID`, `MONITOR_KEYPAIR`, `HELIUS_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`
- Dashboard needs: `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`

## Do NOT

- Edit files inside `worker/src/sdk/` or `dashboard/lib/sdk/` — edit `sdk/` and sync
- Add a root `package.json` or workspace configuration
- Install packages from the repo root
- Commit `.env` files or API keys
- Use Pages Router in the dashboard — App Router only
- Change Anchor version (0.30.1) or Solana CLI (1.18.x) without updating all CI workflows
- Commit `program/target/`
