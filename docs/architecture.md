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
        Server[Server<br/>Express on Railway/Fly.io]
        Claude[Claude API<br/>Haiku judge / Opus reports]
        DB[(Neon Postgres<br/>via Prisma)]
    end

    subgraph "Frontend"
        Dashboard[Dashboard<br/>Next.js on Vercel]
        Wallet[Phantom / Solflare<br/>Owner wallet]
    end

    Agent -->|signs guarded_execute| GR
    GR -->|CPI via PDA signer| Target
    GR -->|escalate if > threshold| Squads
    GR -->|emit events| Helius
    Helius -->|webhook POST| Server
    Server -->|judge call| Claude
    Server -->|persist txns + verdicts| DB
    Server -->|pause_agent tx| GR
    Server -->|SSE push| Dashboard
    Dashboard -->|RPC reads| GR
    Dashboard -->|REST API queries| Server
    Wallet -->|sign txns| Dashboard
```

## guarded_execute Transaction Lifecycle

```mermaid
sequenceDiagram
    participant A as Agent (session key)
    participant G as Guardrails PDA
    participant T as Target Program
    participant H as Helius
    participant S as Server (worker pipeline)
    participant C as Claude Haiku
    participant DB as Neon Postgres
    participant D as Dashboard (via SSE)

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

    H->>S: POST /webhook (event data)
    S->>S: HMAC verify
    S->>DB: Insert guarded_txns row (Prisma)
    S-->>D: SSE emit "new_transaction"
    S->>S: Prefilter (stat checks)
    alt suspicious
        S->>C: Judge request (policy + txn + history)
        C-->>S: { verdict, confidence, reasoning }
        S->>DB: Insert anomaly_verdict (Prisma)
        S-->>D: SSE emit "verdict"
        alt verdict == "pause"
            S->>G: pause_agent(reason)
            S->>DB: Insert incident (Prisma)
            S-->>D: SSE emit "agent_paused"
            S-->>C: Queue Opus incident report (async)
            Note over S,D: SSE emit "report_ready" when done
        end
    end
```

## Server Architecture

```mermaid
graph TB
    subgraph "Server (single Express process)"
        subgraph "Worker Module"
            WH[POST /webhook]
            IN[ingest]
            PF[prefilter]
            JG[judge]
            EX[executor]
            RP[reporter]
        end

        subgraph "API Module"
            TX[GET /api/transactions]
            IC[GET /api/incidents]
            PL[GET /api/policies]
            AU[POST /api/auth/siws/*]
            EV[GET /api/events SSE]
        end

        subgraph "Shared"
            DB_C[db/client.ts<br/>Prisma]
            SSE[sse/emitter.ts<br/>EventEmitter]
        end
    end

    WH --> IN --> PF --> JG --> EX --> RP
    IN --> DB_C
    JG --> DB_C
    EX --> DB_C
    RP --> DB_C
    IN --> SSE
    JG --> SSE
    EX --> SSE
    RP --> SSE

    TX --> DB_C
    IC --> DB_C
    PL --> DB_C
    EV --> SSE
```

## SDK Sync Flow

```mermaid
graph LR
    AB[anchor build] -->|generates| IDL[program/target/idl/guardrails.json]
    IDL -->|sync-sdk.sh copies| SDK[sdk/idl/guardrails.json]
    EDIT[Edit sdk/client.ts<br/>or sdk/types.ts] --> SDK_DIR[sdk/]

    SDK_DIR -->|sync-sdk.sh| S[server/src/sdk/]
    SDK_DIR -->|sync-sdk.sh| D[dashboard/lib/sdk/]

    HOOK[.githooks/pre-commit] -->|auto-triggers| SYNC[scripts/sync-sdk.sh]
    CI[CI workflows] -->|diff check| S
    CI -->|diff check| D
```

**Rule:** Never edit `server/src/sdk/` or `dashboard/lib/sdk/` directly. Always edit `sdk/` and run `bash scripts/sync-sdk.sh`.
