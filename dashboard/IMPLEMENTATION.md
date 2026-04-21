# Dashboard Implementation Plan

Next.js 14 App Router. Frontend only — no API routes, no direct database access. Deploys to Vercel.

---

## 1. Architecture

All data comes from two sources:
- **Solana RPC** — on-chain reads (policies, spend trackers) via Anchor client
- **Server API** — historical data (transactions, incidents, verdicts) + SSE realtime + SIWS auth

```
dashboard/
├── app/              ← Pages (Server Components by default)
│   ├── (auth)/signin
│   ├── agents/
│   ├── activity/
│   └── incidents/
├── components/       ← Reusable UI components
├── lib/
│   ├── api/          ← Fetch helpers for server REST API
│   ├── sse/          ← EventSource hook for realtime
│   ├── mock/         ← Fixture data for building UI without backend
│   ├── sdk/          ← Copy of sdk/ (don't edit)
│   └── types/        ← Shared types
└── scripts/          ← Demo agents + attack simulation
```

---

## 2. Routes

| Route | Purpose |
|---|---|
| `/` | Landing + connect wallet CTA |
| `/signin` | SIWS flow (calls server auth endpoints) |
| `/agents` | List of agents/policies owned by connected wallet |
| `/agents/new` | Create policy wizard (programs, limits, expiry, monitors, squads) |
| `/agents/[pubkey]` | Agent detail — live status, spend gauge, recent txns, controls |
| `/agents/[pubkey]/policy` | Edit policy |
| `/activity` | Global activity feed across all agents |
| `/incidents` | All past pauses with Opus-generated reports |
| `/incidents/[id]` | Incident detail with timeline + judge reasoning |

---

## 3. Components (build in this order)

1. **`WalletProvider` + `SiwsProvider`** — wrap root layout, manage wallet connection + auth state
2. **`PolicyCard`** — compact status card showing agent name, status badge, spend %, session expiry
3. **`CreatePolicyWizard`** — 4-step form: programs → limits → session → escalation
4. **`SpendGauge`** — Recharts radial chart of daily_used / daily_budget
5. **`ActivityFeed`** — SSE-powered live transaction feed
6. **`TxnRow`** — transaction row with verdict badge (allow/flag/pause), expandable reasoning
7. **`KillSwitchButton`** — confirm modal → sends `pause_agent` txn from owner wallet
8. **`IncidentTimeline`** — vertical timeline of events leading to pause

---

## 4. Data fetching

### 4.1 On-chain state (authoritative)

Read via Anchor client, cached with TanStack Query (30s stale time).

```typescript
const { data: policy } = useQuery({
  queryKey: ["policy", pubkey],
  queryFn: () => program.account.permissionPolicy.fetch(new PublicKey(pubkey)),
  staleTime: 30_000,
});
```

### 4.2 Historical data (server API)

Fetch helpers in `lib/api/client.ts`. All calls include `credentials: "include"` for auth cookies.

```typescript
// lib/api/client.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchTransactions(policyPubkey?: string) {
  const url = policyPubkey
    ? `${API_URL}/api/transactions?policy=${policyPubkey}`
    : `${API_URL}/api/transactions`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

export async function fetchIncidents() { /* ... */ }
export async function fetchPolicies() { /* ... */ }
export async function fetchIncident(id: string) { /* ... */ }
```

Used with TanStack Query:

```typescript
const { data: txns, isLoading } = useQuery({
  queryKey: ["transactions", policyPubkey],
  queryFn: () => fetchTransactions(policyPubkey),
});
```

### 4.3 Realtime (SSE)

Single EventSource connection to server. On events, invalidate relevant TanStack Query caches.

```typescript
// lib/sse/useSSE.ts
export function useSSE() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource(`${API_URL}/api/events`, { withCredentials: true });

    source.addEventListener("new_transaction", () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    });

    source.addEventListener("verdict", () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    });

    source.addEventListener("agent_paused", () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
    });

    source.addEventListener("report_ready", () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    });

    return () => source.close();
  }, [queryClient]);
}
```

Mount in root layout or a top-level provider so it's active across all pages.

---

## 5. SIWS auth flow

Dashboard side of Sign-In With Solana. Server handles verification + JWT issuance.

```
1. User clicks "Sign In" → wallet adapter connects

2. Dashboard calls POST {API_URL}/api/auth/siws/nonce
   → receives { nonce, message }

3. Wallet signs the message
   → signMessage(encodedMessage) via wallet adapter

4. Dashboard calls POST {API_URL}/api/auth/siws/verify
   → body: { pubkey, signature, message }
   → server sets httpOnly cookie with JWT

5. All subsequent fetch() calls include credentials: "include"
   → cookie sent automatically
   → server middleware reads walletPubkey from JWT
```

---

## 6. Mock data

`lib/mock/` contains fixture data matching the database schema. Use while building UI before server is ready.

```typescript
import { POLICIES, TRANSACTIONS, VERDICTS, INCIDENTS } from "@/lib/mock";
```

- `policies.ts` — 3 agents: Yield Bot (active), Staking Agent (active), Alpha Scanner (paused)
- `transactions.ts` — 20 txns: swaps + stakes + attack burst
- `verdicts.ts` — 7 verdicts: prefilter-skip → FLAG → PAUSE chain
- `incidents.ts` — 1 incident with full Opus postmortem

Swap for real API calls when server is ready.

---

## 7. Environment variables

```
NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899
NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID=
NEXT_PUBLIC_API_URL=http://localhost:8080
```

All public — no server secrets. Dashboard is frontend only.

---

## 8. Conventions

- Pages are Server Components by default. `"use client"` only for interactivity.
- Tailwind only — no CSS modules
- Dark mode first — design for dark backgrounds
- Shorten pubkeys: `AbCd...xYzW` (first 4 + last 4)
- Wrap wallet interactions in try/catch with error toasts
- `params.pubkey` for agent routes, `params.id` for incidents
- `@/*` path alias → project root

---

## 9. Build order (Week 4)

1. Scaffold + Tailwind + shadcn + wallet adapter + API helpers + SSE hook + SIWS flow (Mon)
2. `/agents` list + `PolicyCard` + TanStack Query hooks (Tue)
3. `/agents/new` wizard (4 steps) + on-chain create policy (Wed)
4. `/agents/[pubkey]` detail + SpendGauge + ActivityFeed via SSE (Thu)
5. `/incidents` + `/incidents/[id]` + Opus reports rendered (Fri)
6. KillSwitchButton + edit-policy + empty/error states (Sat)
7. Deploy to Vercel + end-to-end test (Sun)
