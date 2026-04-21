# Data Contracts

Cross-boundary data shapes used between components. Source: implementation-plan.md sections 3–5.

---

## 1. On-Chain Accounts

### PermissionPolicy (PDA)

Seeds: `["policy", owner_pubkey, agent_pubkey]`

| Field | Type | Notes |
|---|---|---|
| owner | Pubkey | Human owner who can modify policy |
| agent | Pubkey | Agent session pubkey (from Swig or raw) |
| allowed_programs | Vec\<Pubkey\> | Whitelist, max 10 |
| max_tx_lamports | u64 | Per-transaction SOL cap |
| max_tx_token_units | u64 | Per-transaction SPL cap (scaled) |
| daily_budget_lamports | u64 | Rolling 24h SOL cap |
| daily_spent_lamports | u64 | Running counter |
| last_reset_ts | i64 | For daily budget rollover |
| session_expiry | i64 | Unix timestamp |
| is_active | bool | Kill switch |
| paused_by | Option\<Pubkey\> | Who paused |
| paused_reason | [u8; 64] | Fixed-size reason code |
| squads_multisig | Option\<Pubkey\> | Squads multisig address |
| escalation_threshold | u64 | Lamports above which Squads approval required |
| authorized_monitors | Vec\<Pubkey\> | Off-chain monitors allowed to pause, max 3 |
| anomaly_score | u8 | Last judge score 0–100 |
| bump | u8 | PDA bump seed |

### SpendTracker (PDA)

Seeds: `["tracker", policy_pubkey]`

| Field | Type | Notes |
|---|---|---|
| policy | Pubkey | Parent policy |
| window_start | i64 | Start of current 24h window |
| txn_count_24h | u32 | Transaction count in window |
| lamports_spent_24h | u64 | Amount spent in window |
| last_txn_ts | i64 | Timestamp of last transaction |
| last_txn_program | Pubkey | Program called in last txn |
| bump | u8 | PDA bump seed |

---

## 2. On-Chain Events

### GuardedTxnExecuted
```typescript
{
  policy: PublicKey;
  agent: PublicKey;
  targetProgram: PublicKey;
  amount: bigint;       // lamports
  timestamp: bigint;    // unix seconds
  txnSig: string;
}
```

### GuardedTxnRejected
```typescript
{
  policy: PublicKey;
  agent: PublicKey;
  reason: number;       // enum: 0=PolicyPaused, 1=SessionExpired, 2=ProgramNotWhitelisted, 3=AmountExceeds, 4=DailyBudgetExceeded
  timestamp: bigint;
}
```

### AgentPaused
```typescript
{
  policy: PublicKey;
  pausedBy: PublicKey;
  reason: Uint8Array;   // 64 bytes
  timestamp: bigint;
}
```

### EscalatedToSquads
```typescript
{
  policy: PublicKey;
  squadsProposal: PublicKey;
  amount: bigint;
}
```

---

## 3. Supabase Tables

### policies (mirror of on-chain state)
| Column | Type | Notes |
|---|---|---|
| pubkey | text PK | Policy PDA address |
| owner | text | Owner wallet |
| agent | text | Agent session pubkey |
| allowed_programs | text[] | Program addresses |
| max_tx_lamports | bigint | |
| daily_budget_lamports | bigint | |
| session_expiry | timestamptz | |
| is_active | boolean | |
| squads_multisig | text | nullable |
| escalation_threshold | bigint | nullable |
| anomaly_score | smallint | 0–100 |
| label | text | User-friendly name |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### guarded_txns
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| policy_pubkey | text FK→policies | |
| txn_sig | text UNIQUE | Solana transaction signature |
| slot | bigint | |
| block_time | timestamptz | |
| target_program | text | |
| amount_lamports | bigint | nullable |
| status | text | 'executed' \| 'rejected' \| 'escalated' |
| reject_reason | text | nullable |
| raw_event | jsonb | |
| created_at | timestamptz | |

### anomaly_verdicts
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| txn_id | uuid FK→guarded_txns | |
| policy_pubkey | text | |
| verdict | text | 'allow' \| 'flag' \| 'pause' |
| confidence | smallint | 0–100 |
| reasoning | text | |
| model | text | 'claude-haiku-4-5' \| 'claude-opus-4-7' |
| latency_ms | integer | |
| prefilter_skipped | boolean | |
| prompt_tokens | integer | |
| completion_tokens | integer | |
| created_at | timestamptz | |

### incidents
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| policy_pubkey | text FK→policies | |
| paused_at | timestamptz | |
| paused_by | text | Monitor or owner pubkey |
| reason | text | |
| triggering_txn_sig | text | |
| judge_verdict_id | uuid FK→anomaly_verdicts | |
| full_report | text | Opus-generated postmortem |
| resolved_at | timestamptz | nullable |
| resolution | text | nullable |
| created_at | timestamptz | |

---

## 4. Worker ↔ Claude API Contract

### JudgeContext (input to prompt builder)
```typescript
interface JudgeContext {
  policy: {
    agent: string;
    allowedPrograms: string[];
    maxTxSol: number;
    dailyBudgetSol: number;
    dailyUsedPct: number;
    minsToExpiry: number;
  };
  txn: {
    program: string;
    programLabel?: string;
    amountSol: number;
    pctOfCap: number;
    timestamp: string;
  };
  history: Array<{
    program: string;
    amountSol: number;
    status: string;
    minsAgo: number;
  }>;
  baseline: {
    medianAmount: number;
    p95Amount: number;
    activeHours: string;
    uniqueProgramsCount: number;
  };
  prefilterSignals: string[];
}
```

### Verdict (Claude JSON output)
```typescript
interface Verdict {
  verdict: "allow" | "flag" | "pause";
  confidence: number;    // 0–100
  reasoning: string;     // one sentence, <200 chars
  signals: string[];     // short signal strings
}
```
