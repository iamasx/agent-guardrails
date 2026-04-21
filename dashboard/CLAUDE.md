# Guardrails Dashboard

Next.js 14 App Router. Standalone. Deployed on Vercel. Dark mode default.

## Stack

- Tailwind CSS 3.4 + shadcn/ui
- Recharts for charts
- @solana/wallet-adapter-react (Phantom, Solflare, Backpack)
- @tanstack/react-query v5 (server state)
- Zustand (UI state)
- @supabase/supabase-js (queries + Realtime)

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing + connect wallet |
| `/(auth)/signin` | SIWS flow |
| `/agents` | Agent list with PolicyCards |
| `/agents/new` | 4-step create policy wizard |
| `/agents/[pubkey]` | Agent detail + live activity |
| `/agents/[pubkey]/policy` | Edit policy |
| `/activity` | Global activity feed |
| `/incidents` | All pauses with reports |
| `/incidents/[id]` | Incident detail + timeline |

## Data fetching (section 6.3)

- **On-chain:** Anchor client via `lib/sdk/`, cached with TanStack Query (30s stale)
- **Historical:** Supabase query with pagination
- **Live:** Supabase Realtime WS on `guarded_txns` + `incidents`, invalidates TanStack caches

## Mock data (for building UI without backend)

`lib/mock/` contains fixture data matching the Supabase schema exactly (types + data from `docs/data-contracts.md`). Use `import { POLICIES, TRANSACTIONS, VERDICTS, INCIDENTS } from "@/lib/mock"` while building components. Swap for real Supabase queries when the backend is ready.

- `policies.ts` — 3 agents: Yield Bot (active), Staking Agent (active), Alpha Scanner (paused)
- `transactions.ts` — 20 txns: 8 normal swaps + 4 stakes + 3 normal + 5 burst (attack sequence)
- `verdicts.ts` — 7 verdicts: prefilter-skipped allows + FLAG + FLAG + PAUSE chain
- `incidents.ts` — 1 incident with full Opus-generated postmortem report
- `index.ts` — barrel export with types

## Component build order (section 6.2)

1. WalletProvider + SiwsProvider (root layout)
2. PolicyCard
3. CreatePolicyWizard (4 steps)
4. SpendGauge (Recharts radial)
5. ActivityFeed (Supabase Realtime)
6. TxnRow (verdict badge + reasoning)
7. KillSwitchButton (confirm modal)
8. IncidentTimeline

## Path aliases

`@/*` → project root. Use `@/components/Foo`, `@/lib/types/db`.

## Demo scripts

```bash
npm run demo:setup      # Create demo policy
npm run demo:trader     # Honest Jupiter swaps
npm run demo:staker     # Honest Marinade staking
npm run demo:attacker   # Misbehaving agent
npm run demo:simulate   # Full attack orchestration
```

## Conventions

- Pages are Server Components by default. `"use client"` only for interactivity.
- Tailwind only — no CSS modules
- Dark mode first — design for dark backgrounds
- Shorten pubkeys: `AbCd...xYzW` (first 4 + last 4)
- Wrap wallet interactions in try/catch with error toasts
- `params.pubkey` for agent routes, `params.id` for incidents

## Do NOT

- Edit `lib/sdk/` — edit `sdk/` at repo root and sync
- Use Pages Router — App Router only
- Expose `SUPABASE_SERVICE_ROLE` to client
- Add `"use client"` to pages unless necessary — extract interactive parts
- Install CSS frameworks beyond Tailwind + shadcn
- Hardcode public keys or program IDs — use env vars
