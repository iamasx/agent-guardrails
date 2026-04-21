# Architecture

## System Topology

```mermaid
graph TB
    subgraph "On-Chain (Solana)"
        Agent[AI Agent<br/>session key]
        GR[Guardrails Program<br/>PDA policy check]
        Target[Target Program<br/>Jupiter / System / Token]
        Squads[Squads v4<br/>Multisig]
    end

    subgraph "Off-Chain Infrastructure"
        Helius[Helius Webhooks]
        Worker[Worker<br/>Node.js on Fly.io]
        Claude[Claude API<br/>Haiku judge / Opus reports]
        Supabase[(Supabase<br/>Postgres + Realtime)]
    end

    subgraph "Frontend"
        Dashboard[Dashboard<br/>Next.js on Vercel]
        Wallet[Phantom / Solflare<br/>Owner wallet]
    end

    Agent -->|signs guarded_execute| GR
    GR -->|CPI via PDA signer| Target
    GR -->|escalate if > threshold| Squads
    GR -->|emit events| Helius
    Helius -->|webhook POST| Worker
    Worker -->|judge call| Claude
    Worker -->|persist txns + verdicts| Supabase
    Worker -->|pause_agent tx| GR
    Supabase -->|Realtime WS| Dashboard
    Dashboard -->|RPC reads| GR
    Dashboard -->|queries| Supabase
    Wallet -->|sign txns| Dashboard
```

## guarded_execute Transaction Lifecycle

```mermaid
sequenceDiagram
    participant A as Agent (session key)
    participant G as Guardrails PDA
    participant T as Target Program
    participant H as Helius
    participant W as Worker
    participant C as Claude Haiku
    participant S as Supabase
    participant D as Dashboard

    A->>G: guarded_execute(target, data, amount_hint)
    G->>G: 1. Load PermissionPolicy PDA
    G->>G: 2. Assert is_active == true
    G->>G: 3. Assert session not expired
    G->>G: 4. Assert target in allowed_programs
    G->>G: 5. Assert amount <= max_tx_lamports
    G->>G: 6. Roll daily budget if 24h elapsed
    G->>G: 7. Assert daily budget not exceeded
    alt amount > escalation_threshold
        G-->>A: EscalatedToMultisig error
    else within limits
        G->>G: 8. Emit GuardedTxnAttempted
        G->>T: 9. CPI with PDA signer seeds
        G->>G: 10. Update SpendTracker
        G->>G: 11. Emit GuardedTxnExecuted
    end

    H->>W: POST webhook (event data)
    W->>W: HMAC verify
    W->>S: Insert guarded_txns row
    W->>W: Prefilter (stat checks)
    alt suspicious
        W->>C: Judge request (policy + txn + history)
        C-->>W: { verdict, confidence, reasoning }
        W->>S: Insert anomaly_verdict
        alt verdict == "pause"
            W->>G: pause_agent(reason)
            W->>S: Insert incident
            W-->>C: Queue Opus incident report (async)
        end
    end
    S-->>D: Realtime update
```

## SDK Sync Flow

```mermaid
graph LR
    AB[anchor build] -->|generates| IDL[program/target/idl/guardrails.json]
    IDL -->|sync-sdk.sh copies| SDK[sdk/idl/guardrails.json]
    EDIT[Edit sdk/client.ts<br/>or sdk/types.ts] --> SDK_DIR[sdk/]

    SDK_DIR -->|sync-sdk.sh| W[worker/src/sdk/]
    SDK_DIR -->|sync-sdk.sh| D[dashboard/lib/sdk/]

    HOOK[.githooks/pre-commit] -->|auto-triggers| SYNC[scripts/sync-sdk.sh]
    CI[CI workflows] -->|diff check| W
    CI -->|diff check| D
```

**Rule:** Never edit `worker/src/sdk/` or `dashboard/lib/sdk/` directly. Always edit `sdk/` and run `bash scripts/sync-sdk.sh`.
