# Contributing to Agent Guardrails Protocol

## Prerequisites

- Rust 1.75+ (`rustc --version`)
- Solana CLI 1.18+ (`solana --version`)
- Anchor CLI 0.30.1 (`anchor --version`)
- Node.js 20+ (`node --version`)
- pnpm 9+ (`pnpm --version`)
- Git 2.20+ (for worktree support)

See [docs/env-setup.md](docs/env-setup.md) for the full local setup guide.

## First-Time Setup

```bash
git clone https://github.com/AgentGuards/agent-guardrails.git
cd agent-guardrails

# Configure git hooks (auto-syncs SDK on commit)
git config core.hooksPath .githooks

# Build program + sync SDK
cd program && anchor build && cd ..
bash scripts/sync-sdk.sh
```

### AI Tool Context

This repo has rich context files for Claude Code (`CLAUDE.md`, `.claude/`). If you use a different AI tool, generate context files first:

```bash
# Cursor
bash contributing/scripts/setup-cursor.sh

# Codex
bash contributing/scripts/setup-codex.sh

# VS Code + Copilot
bash contributing/scripts/setup-vscode.sh
```

See [contributing/README.md](contributing/README.md) for details.

---

## Workflow

### 1. Pick a feature

Check the project board or `implementation-plan.md` for what needs to be done. Each sub-project has a build order in its `IMPLEMENTATION.md`:

- `program/IMPLEMENTATION.md` §8 — program build order
- `server/IMPLEMENTATION.md` §6 — server build order
- `dashboard/IMPLEMENTATION.md` §10 — dashboard build order

### 2. Create a parent issue

Open a GitHub issue for the feature. Include a plan as a checklist:

```markdown
## Implement server pipeline

- [ ] ingest.ts — HMAC verify, parse Helius payload, write to DB
- [ ] prefilter.ts — statistical checks, skip LLM for routine txns
- [ ] judge.ts — Claude Haiku integration with timeout/fallback
- [ ] executor.ts — on-chain pause_agent + incident creation
- [ ] reporter.ts — Opus incident report (async)
```

This is the plan. Subtask issues are created one at a time as you go (not all upfront).

### 3. Create a worktree

```bash
# From the main repo directory
git worktree add ../guardrails-[feature-name] main
cd ../guardrails-[feature-name]
```

This gives you a separate working directory on `main`. The main repo is untouched — you can have multiple worktrees for parallel features.

```
agent-guardrails/                    ← main repo (untouched)
guardrails-server-pipeline/          ← worktree for server pipeline
guardrails-dashboard-components/     ← worktree for dashboard work
```

### 4. Work on subtasks sequentially

For each subtask:

**a. Create a subtask issue**

Only create the next issue, not all of them. Plans change as you implement.

**b. Create a branch from main**

```bash
git checkout -b feat/server-ingest
```

**c. Implement**

Read the relevant `IMPLEMENTATION.md` before writing code. Follow the conventions in the sub-project's `CLAUDE.md`.

**d. Commit with conventional messages**

```bash
git commit -m "feat(server): implement ingest pipeline with HMAC verification

Closes #11"
```

**e. Push and create a PR**

```bash
git push -u origin feat/server-ingest
gh pr create --title "feat(server): implement ingest pipeline" --body "Closes #11"
```

**f. Merge the PR**

After review (or self-merge if you're the maintainer):

```bash
# On GitHub: Squash and merge
```

**g. Update the worktree and start next subtask**

```bash
git checkout main
git pull
git checkout -b feat/server-prefilter
# continue with next subtask
```

### 5. Clean up

When the feature is done:

```bash
cd ../agent-guardrails
git worktree remove ../guardrails-[feature-name]
```

Check off all items in the parent issue and close it.

---

## Commit Messages

Use [conventional commits](https://www.conventionalcommits.org/):

```
feat(program): implement initialize_policy instruction
fix(server): handle Claude API timeout with fallback verdict
docs: update walkthrough with Swig session key flow
chore: update prisma dependencies
test(program): add guarded_execute rejection path tests
refactor(dashboard): extract SpendGauge into separate component
```

**Scopes:** `program`, `server`, `dashboard`, `sdk`, `docs`, `ci`

**Rules:**
- Subject line under 72 characters
- Use imperative mood ("implement", not "implemented")
- Reference issue number: `Closes #11` or `Fixes #11`
- One logical change per commit

---

## Pull Requests

### Size

One PR should be **reviewable in 15 minutes**. If it takes longer, split it. If it takes 2 minutes, consider combining with the next subtask.

**Good PR size:**
- One instruction implementation (program)
- One pipeline stage (server)
- One component (dashboard)

**Too big:**
- "Implement entire server pipeline" (split into per-stage PRs)
- "Build all dashboard pages" (split into per-page PRs)

**Too small (combine with next):**
- "Add one import statement"
- "Fix typo in comment"

### PR template

```markdown
## What

[One sentence: what this PR does]

## Why

[Link to issue: Closes #N]

## How to test

[Steps to verify: build command, test command, or manual check]

## Checklist

- [ ] `IMPLEMENTATION.md` spec followed
- [ ] CLAUDE.md conventions followed
- [ ] Builds: `anchor build` / `pnpm build` / `npm run build`
- [ ] SDK synced (if program/ or sdk/ changed): `bash scripts/sync-sdk.sh`
- [ ] No secrets committed (.env, API keys, keypairs)
```

### Review

- Program changes: check account constraints, PDA seeds, compute budget
- Server changes: check Prisma queries, SSE payloads, auth middleware
- Dashboard changes: check Server Components vs "use client", dark mode, credentials: "include"
- SDK changes: verify sync to both consumers

---

## Coding Standards

Each sub-project has its own conventions in its `CLAUDE.md`. Read it before contributing. Key rules:

### All sub-projects

- Read the `IMPLEMENTATION.md` before writing code
- Don't edit `server/src/sdk/` or `dashboard/lib/sdk/` — edit `sdk/` and sync
- Don't commit `.env` files, API keys, or keypairs
- Don't add a root `package.json` or workspace config

### Program (`program/`)

- Anchor 0.30.1, Rust edition 2021
- `require!()` with `GuardrailsError` variants for validation
- No `String` types in accounts — use `[u8; N]`
- `emit!()` for events, `msg!()` for debug only
- Stay under 200k compute units per instruction
- After `anchor build`, run `bash scripts/sync-sdk.sh`

### Server (`server/`)

- ESM (`"type": "module"`) — use `import`/`export`, never `require`
- Worker and API modules never import from each other
- All DB queries via Prisma client (`src/db/client.ts`)
- All SSE events via emitter (`src/sse/emitter.ts`)
- Auth middleware skips `/webhook` and `/api/auth/*`
- Protected queries filter by `owner = walletPubkey` from JWT
- Never include txn memo fields in Claude prompt (injection risk)
- Opus reports are async — never block the webhook handler

### Dashboard (`dashboard/`)

- Next.js 14 App Router only — no Pages Router, no API routes
- Pages are Server Components by default — `"use client"` only for interactivity
- Tailwind only — no CSS modules
- Dark mode first
- TanStack Query for server state, Zustand for client UI state
- SSE uses `setQueryData` (no refetch) — update both global and filtered caches
- All `fetch()` calls include `credentials: "include"`
- Shorten pubkeys in UI: `AbCd...xYzW` (first 4 + last 4)

---

## Testing

### Program

```bash
cd program
anchor test --skip-local-validator --skip-deploy
```

Tests use LiteSVM (in-process, no validator needed). Every instruction should have tests for:
- Happy path
- Every rejection path (wrong signer, expired, over limit, paused, etc.)
- Edge cases (budget rollover, zero amounts, max array sizes)

### Server

```bash
cd server
pnpm build    # TypeScript compiles without errors
```

Test the pipeline with mock webhook payloads. Verify Prisma queries return expected data.

### Dashboard

```bash
cd dashboard
npm run build    # Next.js builds without errors
npm run lint     # ESLint passes
```

Verify components render with mock data. Check dark mode, responsive layout, empty states.

### SDK sync check

```bash
diff -rq sdk/ server/src/sdk/
diff -rq sdk/ dashboard/lib/sdk/
```

Both should report no differences. If they do, run `bash scripts/sync-sdk.sh`.

---

## Working on Multiple Features

Use git worktrees to work on multiple features in parallel:

```bash
# Feature 1: server pipeline
git worktree add ../guardrails-server-pipeline main
cd ../guardrails-server-pipeline

# Feature 2: dashboard components (separate terminal)
git worktree add ../guardrails-dashboard-ui main
cd ../guardrails-dashboard-ui
```

Each worktree is independent — different directory, different branch, no conflicts. Run your AI tool in each directory separately.

**After creating a worktree, run your AI tool's setup script** (if not using Claude Code):

```bash
bash contributing/scripts/setup-cursor.sh    # Cursor
bash contributing/scripts/setup-codex.sh     # Codex
bash contributing/scripts/setup-vscode.sh    # VS Code + Copilot
```

Claude Code users: no setup needed — `CLAUDE.md` files are committed and auto-loaded.

---

## What NOT to Do

- Don't edit `server/src/sdk/` or `dashboard/lib/sdk/` directly
- Don't add a root `package.json` or workspace configuration
- Don't install packages from the repo root
- Don't commit `.env` files, API keys, or keypairs
- Don't use Pages Router in the dashboard
- Don't commit `program/target/`
- Don't change Anchor version (0.30.1) without updating all CI workflows
- Don't import between `server/src/worker/` and `server/src/api/`
- Don't add API routes to the dashboard — it's frontend only
- Don't hardcode public keys or program IDs — use env vars
- Don't skip the SDK sync after editing `sdk/` or `program/`

---

## Getting Help

- Read the relevant `IMPLEMENTATION.md` — it has detailed specs with code examples
- Read `docs/walkthrough.md` — end-to-end system flow with demo example
- Read `docs/data-contracts.md` — all data shapes across boundaries
- Open an issue with the `question` label
