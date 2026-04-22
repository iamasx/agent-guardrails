# Hackathon Workflow — 3 Person Team

Quick workflow for the Solana Frontier hackathon. Replace with the full [CONTRIBUTING.md](CONTRIBUTING.md) after submission.

---

## Team Split

| Person | Area | Branch(es) | Directory |
|--------|------|-----------|-----------|
| **Ronin** | Program | `program`, `program:tests` | `program/` |
| **Spectre** | Server | `server:worker`, `server:api`, `server:prisma` | `server/` |
| **Neon** | Dashboard | `dashboard`, `dashboard:demo` | `dashboard/` |

No overlap — each person owns their directory.

---

## Setup (everyone, once)

```bash
# 1. Fork AgentGuards/agent-guardrails on GitHub

# 2. Clone your fork
git clone https://github.com/[your-name]/agent-guardrails.git
cd agent-guardrails

# 3. Add upstream
git remote add upstream https://github.com/AgentGuards/agent-guardrails.git

# 4. Configure hooks
git config core.hooksPath .githooks

# 5. Build program + sync SDK
cd program && pnpm install && anchor build && cd ..
bash scripts/sync-sdk.sh

# 6. AI tool setup (skip if using Claude Code)
bash contributing/scripts/setup-cursor.sh    # Cursor users
bash contributing/scripts/setup-codex.sh     # Codex users
bash contributing/scripts/setup-vscode.sh    # VS Code users
```

Verify remotes:
```bash
git remote -v
# origin    https://github.com/[your-name]/agent-guardrails.git
# upstream  https://github.com/AgentGuards/agent-guardrails.git
```

---

## Daily Work

### Start of day — sync

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### Work on your branch

```bash
# Create or switch to your branch
git checkout -b server:worker    # first time
git checkout server:worker       # already exists

# Implement...
# Commit often
git add server/src/worker/pipeline/ingest.ts
git commit -m "feat(server): implement ingest pipeline with HMAC verification"

# Push to your fork
git push origin server:worker
```

### PR when ready

When your branch has meaningful progress (not every commit — batch a few):

```bash
gh pr create \
  --repo AgentGuards/agent-guardrails \
  --base main \
  --head [your-github-name]:server:worker \
  --title "feat(server): implement worker pipeline" \
  --body "Implements ingest, prefilter, and judge modules."
```

Or create the PR on GitHub: your fork → "Compare & pull request" → base: `AgentGuards/main`.

### Merge your own PR

Everyone is a collaborator — no review bottleneck. Merge your own PRs on upstream. Use **Squash and merge** to keep history clean.

### Start next branch

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
git checkout -b server:api
```

---

## Branch Guide

### Ronin — Program

```bash
# Branch: program
# Covers: account structs, all instructions, events, errors

git checkout -b program
# Read: program/IMPLEMENTATION.md §8 for build order
# 1. Account structs (PermissionPolicy + SpendTracker full fields)
# 2. Events (4 event structs)
# 3. initialize_policy + update_policy
# 4. guarded_execute (12-step flow)
# 5. pause_agent + resume_agent
# 6. rotate_agent_key
# 7. escalate_to_squads

# After anchor build — ALWAYS sync SDK
bash scripts/sync-sdk.sh
git add sdk/ server/src/sdk/ dashboard/lib/sdk/
git commit -m "chore: sync SDK after anchor build"
git push origin program
# PR to upstream — Spectre and 3 will pull to get new IDL
```

Test branch (if separating tests):
```bash
git checkout -b program:tests
# All LiteSVM test cases
# anchor test --skip-local-validator --skip-deploy
```

### Spectre — Server

```bash
# Branch: server:worker
# Covers: webhook, ingest, prefilter, judge, executor, reporter

git checkout -b server:worker
# Read: server/IMPLEMENTATION.md §3 for pipeline details
# 1. Express skeleton + Prisma client + env config
# 2. Webhook route (HMAC verify)
# 3. Ingest (parse + DB write + SSE emit)
# 4. Prefilter (stat checks + queries)
# 5. Judge (Claude Haiku + timeout/fallback)
# 6. Executor (on-chain pause_agent)
# 7. Reporter (Opus async)

# Branch: server:api
# Covers: REST routes, SSE, SIWS auth, middleware

git checkout -b server:api
# Read: server/IMPLEMENTATION.md §4 for API details
# 1. Auth middleware (JWT verify)
# 2. CORS middleware
# 3. SIWS routes (nonce + verify)
# 4. Transactions route
# 5. Incidents route
# 6. Policies route
# 7. SSE events route

# Branch: server:prisma (if migrations need separate PR)
git checkout -b server:prisma
# First migration from schema.prisma
```

### Neon — Dashboard

```bash
# Branch: dashboard
# Covers: all pages + components

git checkout -b dashboard
# Read: dashboard/IMPLEMENTATION.md §3 + §10 for component specs + build order
# 1. Root layout (WalletProvider + SiwsProvider + useSSE hook)
# 2. API client (lib/api/client.ts)
# 3. SSE hook (lib/sse/useSSE.ts)
# 4. Zustand stores (lib/stores/)
# 5. PolicyCard component
# 6. /agents page
# 7. CreatePolicyWizard + /agents/new page
# 8. SpendGauge + ActivityFeed + TxnRow
# 9. /agents/[pubkey] detail page
# 10. KillSwitchButton
# 11. IncidentTimeline + /incidents pages

# Branch: dashboard:demo (if separating demo scripts)
git checkout -b dashboard:demo
# setup-demo.ts, simulate-attack.ts, demo agents
```

---

## Coordination Points

### 1. SDK sync (Ronin → Spectre + 3)

When Ronin pushes program changes with a new IDL:

```
Ronin: anchor build → sync-sdk.sh → commit → push → PR → merge to upstream
Spectre: git fetch upstream && git merge upstream/main (gets new IDL)
Neon: git fetch upstream && git merge upstream/main (gets new IDL)
```

**Don't start server or dashboard implementation until the first SDK sync is merged.**

### 2. API contract (Spectre ↔ Neon)

Already defined in `docs/data-contracts.md`:
- §3: Prisma schema (what the API returns)
- §5: SSE event payloads (what the dashboard receives)

If Spectre changes the API response shape, update `docs/data-contracts.md` and tell Neon.

### 3. Prisma migration (Spectre → upstream)

Spectre creates the first migration early — Neon needs the schema to validate mock data types:

```bash
cd server
npx prisma migrate dev --name init
git add prisma/migrations/
git commit -m "feat(server): initial prisma migration"
```

---

## Commit Messages

```
feat(program): implement initialize_policy with all constraints
feat(server): implement prefilter with Prisma queries
feat(dashboard): build PolicyCard component
fix(server): handle Claude API timeout with fallback
chore: sync SDK after anchor build
docs: update data contracts with new event field
```

---

## Quick Reference

```bash
# Sync from upstream
git fetch upstream && git merge upstream/main

# Push your branch
git push origin [branch-name]

# Create PR
gh pr create --repo AgentGuards/agent-guardrails --base main --head [you]:[branch]

# SDK sync (after anchor build)
bash scripts/sync-sdk.sh

# Build checks
cd program && anchor build
cd server && pnpm build
cd dashboard && npm run build

# Run locally
cd server && pnpm dev          # http://localhost:8080
cd dashboard && npm run dev     # http://localhost:3000
```

---

## Timeline Targets

| Week | Ronin (Program) | Spectre (Server) | Neon (Dashboard) |
|------|--------------------|--------------------|---------------------|
| 1 | Account structs, init/update/guarded_execute, tests | Express skeleton, Prisma migration, webhook + ingest | Scaffold, layout, wallet provider, API client, SSE hook |
| 2 | SpendTracker, pause/resume, Swig, Squads | Prefilter, judge, executor, reporter | PolicyCard, agents pages, CreatePolicyWizard |
| 3 | Tests, devnet deploy, SDK final sync | API routes, SSE, SIWS auth, deploy | Agent detail, activity feed, incidents pages |
| 4 | Bug fixes, compute optimization | Bug fixes, load testing | KillSwitch, IncidentTimeline, polish |
| 5 | Demo support | Demo support | Demo scripts, video, submission |
