# Data Contracts

Cross-boundary data shapes used between components.

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

## 3. Database Tables (Neon Postgres via Prisma)

Schema defined in `server/prisma/schema.prisma`. Blockchain is source of truth for policies — DB mirrors for query speed.

### policies (mirror of on-chain state)
| Column | Prisma field | Type | Notes |
|---|---|---|---|
| pubkey | pubkey | String @id | Policy PDA address |
| owner | owner | String | Owner wallet |
| agent | agent | String | Agent session pubkey |
| allowed_programs | allowedPrograms | String[] | Program addresses |
| max_tx_lamports | maxTxLamports | BigInt | |
| daily_budget_lamports | dailyBudgetLamports | BigInt | |
| session_expiry | sessionExpiry | DateTime | |
| is_active | isActive | Boolean | |
| squads_multisig | squadsMultisig | String? | |
| escalation_threshold | escalationThreshold | BigInt? | |
| anomaly_score | anomalyScore | Int @db.SmallInt | 0–100 |
| label | label | String? | User-friendly name |
| created_at | createdAt | DateTime | |
| updated_at | updatedAt | DateTime | |

### guarded_txns
| Column | Prisma field | Type | Notes |
|---|---|---|---|
| id | id | String @id @default(uuid()) | |
| policy_pubkey | policyPubkey | String FK→policies | |
| txn_sig | txnSig | String @unique | Solana transaction signature |
| slot | slot | BigInt | |
| block_time | blockTime | DateTime | |
| target_program | targetProgram | String | |
| amount_lamports | amountLamports | BigInt? | |
| status | status | String | 'executed' \| 'rejected' \| 'escalated' |
| reject_reason | rejectReason | String? | |
| raw_event | rawEvent | Json? | |
| created_at | createdAt | DateTime | |

### anomaly_verdicts
| Column | Prisma field | Type | Notes |
|---|---|---|---|
| id | id | String @id @default(uuid()) | |
| txn_id | txnId | String @unique FK→guarded_txns | cascade delete |
| policy_pubkey | policyPubkey | String | |
| verdict | verdict | String | 'allow' \| 'flag' \| 'pause' |
| confidence | confidence | Int @db.SmallInt | 0–100 |
| reasoning | reasoning | String | |
| model | model | String | 'claude-haiku-4-5' \| 'claude-opus-4-7' |
| latency_ms | latencyMs | Int? | |
| prefilter_skipped | prefilterSkipped | Boolean | |
| prompt_tokens | promptTokens | Int? | |
| completion_tokens | completionTokens | Int? | |
| created_at | createdAt | DateTime | |

### incidents
| Column | Prisma field | Type | Notes |
|---|---|---|---|
| id | id | String @id @default(uuid()) | |
| policy_pubkey | policyPubkey | String FK→policies | |
| paused_at | pausedAt | DateTime | |
| paused_by | pausedBy | String | Monitor or owner pubkey |
| reason | reason | String | |
| triggering_txn_sig | triggeringTxnSig | String? | |
| judge_verdict_id | judgeVerdictId | String? FK→anomaly_verdicts | |
| full_report | fullReport | String? | Opus-generated postmortem |
| resolved_at | resolvedAt | DateTime? | |
| resolution | resolution | String? | |
| created_at | createdAt | DateTime | |

### auth_sessions
| Column | Prisma field | Type | Notes |
|---|---|---|---|
| id | id | String @id @default(uuid()) | |
| wallet_pubkey | walletPubkey | String | |
| nonce | nonce | String | |
| signed_at | signedAt | DateTime? | |
| expires_at | expiresAt | DateTime | |
| created_at | createdAt | DateTime | |

---

## 4. Server ↔ Claude API Contract

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

---

## 5. SSE Event Types (Server → Dashboard)

Four event types pushed via `GET /api/events` (Server-Sent Events):

| Event | Emitted by | Payload | Dashboard action |
|---|---|---|---|
| `new_transaction` | ingest.ts | GuardedTxn row | Invalidate transactions query |
| `verdict` | judge.ts | AnomalyVerdict + signals | Invalidate transactions query |
| `agent_paused` | executor.ts | Incident row | Invalidate incidents + policies queries |
| `report_ready` | reporter.ts | { incidentId, policyPubkey } | Invalidate incidents query |
