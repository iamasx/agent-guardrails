# System Walkthrough — End to End with Demo Example

A complete trace of how Agent Guardrails Protocol works, from policy creation to attack detection and pause, using the demo scenario.

---

## Cast of characters

| Actor | Role | Key |
|-------|------|-----|
| **Alice** | Human owner, controls policies | Phantom wallet `7xKX...AsU` |
| **Yield Bot** | Honest trading agent | Session key `Fg6P...LnS` |
| **Alpha Scanner** | Compromised agent (attacker in demo) | Session key `J2HH...QAA` |
| **Monitor** | Server's keypair, authorized to pause | `9WzD...WWM` |
| **Claude Haiku** | AI judge on the hot path | `claude-haiku-4-5-20251001` |
| **Claude Opus** | Incident report writer | `claude-opus-4-7` |

---

## Phase 0: Authentication (SIWS)

Before Alice can do anything, she signs in with her Solana wallet.

### Step 1: Connect wallet

Alice opens `https://guardrails.vercel.app` and clicks "Connect Wallet". The Solana wallet adapter prompts her to select Phantom. Her wallet connects — the dashboard now knows her pubkey `7xKX...AsU` but hasn't verified ownership yet.

### Step 2: Sign-In With Solana (SIWS)

Alice clicks "Sign In". The dashboard starts the SIWS flow:

```
Dashboard                          Server                            Database
   │                                 │                                  │
   ├─ POST /api/auth/siws/nonce ──→  │                                  │
   │                                 ├─ Generate random nonce ──────→   │
   │                                 │  INSERT auth_sessions            │
   │                                 │  {walletPubkey: "7xKX...",       │
   │                                 │   nonce: "a8f3...",              │
   │                                 │   expiresAt: now + 10min}        │
   │  ←── { nonce, message } ───────┤                                  │
   │                                 │                                  │
   │  Phantom popup:                 │                                  │
   │  "Sign this message to          │                                  │
   │   verify wallet ownership"      │                                  │
   │  Alice clicks "Sign"            │                                  │
   │                                 │                                  │
   ├─ POST /api/auth/siws/verify ──→ │                                  │
   │  { pubkey, signature, message } │                                  │
   │                                 ├─ tweetnacl.sign.detached.verify()│
   │                                 │  Verify signature matches pubkey │
   │                                 ├─ UPDATE auth_sessions            │
   │                                 │  SET signedAt = now()            │
   │                                 ├─ Sign JWT { walletPubkey }       │
   │                                 │  with JWT_SECRET                 │
   │  ←── Set-Cookie: token=<JWT> ──┤  (httpOnly, Secure, SameSite=None)
   │      (httpOnly — JS can't       │                                  │
   │       read it, browser sends    │                                  │
   │       it automatically)         │                                  │
   │                                 │                                  │
   │  All future fetch() calls       │                                  │
   │  include credentials: "include" │                                  │
   │  → cookie sent automatically    │                                  │
   │  → server reads walletPubkey    │                                  │
   │     from JWT on every request   │                                  │
```

Alice is now authenticated. The server knows every API request from her browser belongs to wallet `7xKX...AsU`. All queries are filtered to only return her data.

---

## Phase 1: Agent Session Key

Before creating a policy, Alice needs an agent session key — a separate keypair that the AI agent will use to sign transactions. The agent never holds Alice's main wallet key.

### How the session key is created (Swig)

Alice uses Swig to create a scoped session key from the dashboard:

```
Dashboard (/agents/new)                 Swig SDK                    Solana
   │                                       │                          │
   ├─ "Create session key" button ────→    │                          │
   │                                       ├─ Create Swig sub-account │
   │                                       │  with restrictions:       │
   │                                       │  - Scoped to Guardrails   │
   │                                       │    program only           │
   │                                       │  - Expires in N days      │
   │                                       │  - Signing restrictions   │
   │                                       ├─ Submit to Solana ──────→ │
   │                                       │                          │
   │  ←── { sessionPubkey: "J2HH...QAA" } │                          │
   │                                       │                          │
   │  Auto-fills agent pubkey field        │                          │
   │  in the Create Policy wizard          │                          │
```

Swig enforces session expiry and signing restrictions at the wallet layer. Guardrails enforces program/amount restrictions at the contract layer. Defense in depth.

The agent process receives the Swig session key and uses it to sign `guarded_execute` transactions.

### Key point: the agent key holds NO funds

The session key is only used to sign `guarded_execute` calls. It doesn't hold SOL or tokens. Even if compromised, the attacker can only act within the policy's limits — and the AI judge can pause it.

---

## How an AI Agent Integrates with Guardrails

This section explains where Guardrails fits in an agent's runtime — the "before and after" of adopting the protocol.

### Without Guardrails (today's agents)

A typical Solana AI agent (built with Solana Agent Kit, LangChain, or custom code) holds a full-privilege keypair and calls programs directly:

```
┌──────────────────────────────────────────────────┐
│  Agent Runtime (e.g., Node.js process)           │
│                                                  │
│  const wallet = Keypair.fromSecretKey(...)       │
│  // wallet holds SOL + tokens directly           │
│                                                  │
│  // Agent decides to swap on Jupiter:            │
│  jupiter.swap({                                  │
│    inputMint: USDC,                              │
│    outputMint: SOL,                              │
│    amount: 500_000_000,                          │
│    userPublicKey: wallet.publicKey,  ← full key  │
│  })                                              │
│                                                  │
│  // Nothing stops it from:                       │
│  // - Draining the entire wallet                 │
│  // - Calling any program                        │
│  // - Spending unlimited amounts                 │
│  // - Operating after session should end         │
└──────────────────────────────────────────────────┘
         │
         ▼ direct call, no restrictions
┌──────────────────┐
│  Jupiter / DeFi  │
└──────────────────┘
```

If the agent is compromised (prompt injection, key leak, buggy logic), there's no safety net. It has the same power as the human owner.

### With Guardrails

The agent's runtime changes in two ways:
1. It uses a **Swig session key** instead of the owner's wallet
2. Every on-chain action goes through **`guarded_execute`** instead of calling programs directly

```
┌──────────────────────────────────────────────────┐
│  Agent Runtime (same Node.js process)            │
│                                                  │
│  const sessionKey = loadSwigSessionKey(...)      │
│  // session key holds NO funds                   │
│  // scoped to Guardrails program only            │
│                                                  │
│  // Agent decides to swap on Jupiter:            │
│  // Instead of calling Jupiter directly,         │
│  // it calls guarded_execute:                    │
│                                                  │
│  guardrailsProgram.methods                       │
│    .guardedExecute(                              │
│      jupiterProgramId,         // target         │
│      jupiterInstructionData,   // what to do     │
│      jupiterAccountMetas,      // accounts       │
│      new BN(500_000_000),      // amount hint    │
│    )                                             │
│    .signers([sessionKey])      ← limited key     │
│    .rpc()                                        │
│                                                  │
│  // The agent CANNOT:                            │
│  // ✗ Call non-whitelisted programs              │
│  // ✗ Spend above per-tx or daily limits         │
│  // ✗ Operate after session expiry               │
│  // ✗ Continue after being paused                │
└──────────────────────────────────────────────────┘
         │
         ▼ guarded_execute (session key signs)
┌──────────────────────────────────────────────────┐
│  Guardrails Program (on-chain)                   │
│                                                  │
│  1. Load policy → check allow-list, budgets      │
│  2. Validate amount, session, active status      │
│  3. If OK → CPI to Jupiter (PDA signs)           │
│  4. Update spend tracker                         │
│  5. Emit events for monitoring                   │
└──────────────────────────────────────────────────┘
         │
         ▼ CPI (policy PDA signs, not agent)
┌──────────────────┐
│  Jupiter / DeFi  │
└──────────────────┘
```

### What changes in the agent's code

The integration is minimal. Here's a before/after for a Jupiter swap:

**Before (direct call):**
```typescript
// Agent calls Jupiter directly with full wallet
const tx = await jupiter.swap({
  inputMint: USDC_MINT,
  outputMint: SOL_MINT,
  amount: 500_000_000,
  userPublicKey: wallet.publicKey,
  slippageBps: 50,
});
await sendAndConfirmTransaction(connection, tx, [wallet]);
```

**After (through Guardrails):**
```typescript
// Agent builds the Jupiter instruction but routes it through guarded_execute
const jupiterIx = await jupiter.createSwapInstruction({
  inputMint: USDC_MINT,
  outputMint: SOL_MINT,
  amount: 500_000_000,
  userPublicKey: policyPda,  // ← PDA is the authority, not agent
  slippageBps: 50,
});

await guardrailsProgram.methods
  .guardedExecute(
    jupiterIx.programId,
    jupiterIx.data,
    jupiterIx.keys,
    new BN(500_000_000),
  )
  .accounts({
    policy: policyPda,
    spendTracker: spendTrackerPda,
    agent: sessionKey.publicKey,
    targetProgram: jupiterIx.programId,
    clock: SYSVAR_CLOCK_PUBKEY,
  })
  .remainingAccounts(jupiterIx.keys)
  .signers([sessionKey])
  .rpc();
```

The key differences:
1. **Authority changes:** Jupiter sees the policy PDA as the user, not the agent
2. **Session key signs:** The agent uses its limited Swig key, not the owner's wallet
3. **Validation happens automatically:** The program checks limits before CPI
4. **Events are emitted:** The server monitors everything in real-time

### What the agent framework needs

For agents built with Solana Agent Kit (SendAI) or similar frameworks, the integration is a wrapper:

```typescript
// Wrap the agent's action executor
class GuardedExecutor {
  constructor(
    private program: Program,
    private sessionKey: Keypair,
    private policyPda: PublicKey,
    private spendTrackerPda: PublicKey,
  ) {}

  // Replace the agent's default send method
  async execute(instruction: TransactionInstruction, amountLamports: bigint) {
    return this.program.methods
      .guardedExecute(
        instruction.programId,
        instruction.data,
        instruction.keys,
        new BN(amountLamports.toString()),
      )
      .accounts({
        policy: this.policyPda,
        spendTracker: this.spendTrackerPda,
        agent: this.sessionKey.publicKey,
        targetProgram: instruction.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .remainingAccounts(instruction.keys)
      .signers([this.sessionKey])
      .rpc();
  }
}

// Usage in agent code:
const executor = new GuardedExecutor(program, sessionKey, policyPda, trackerPda);

// Instead of: await sendTransaction(jupiterSwapIx)
// Now:        await executor.execute(jupiterSwapIx, 500_000_000n)
```

Any agent framework that produces `TransactionInstruction` objects can be wrapped with `GuardedExecutor`. The agent's decision-making logic doesn't change — only the execution layer.

### The complete runtime picture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agent Runtime                                                      │
│                                                                     │
│  ┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐ │
│  │ AI Decision │ ──→ │ Build Instruction │ ──→ │ GuardedExecutor  │ │
│  │ (LLM/logic) │     │ (Jupiter, etc.)  │     │ (wraps in        │ │
│  │             │     │                  │     │  guarded_execute) │ │
│  └─────────────┘     └──────────────────┘     └────────┬─────────┘ │
│                                                        │           │
│  Swig session key signs ──────────────────────────────┘           │
└───────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────┐
│  Solana                                                           │
│                                                                   │
│  ┌─────────────────────┐      ┌──────────────────┐               │
│  │ Guardrails Program  │ CPI  │ Target Program   │               │
│  │ (validate + proxy)  │ ───→ │ (Jupiter, etc.)  │               │
│  │                     │      │                  │               │
│  │ Policy PDA signs ───┘      └──────────────────┘               │
│  │ Events emitted ────────────────────────────────→ Helius       │
│  └─────────────────────┘                                         │
└───────────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│  Server (monitoring)                                              │
│  Helius webhook → ingest → prefilter → judge → executor/reporter │
│  SSE push → Dashboard                                            │
└───────────────────────────────────────────────────────────────────┘
```

The agent thinks and decides. The `GuardedExecutor` routes every action through Guardrails. The program enforces limits on-chain. The server watches everything off-chain. Three layers, one integration point.

---

## Phase 2: Policy Creation & Funding

Alice creates the policy and funds it so the agent can spend.

### Step 1: Create policy on the dashboard (`/agents/new`)

```
Step 1 — Programs:  [Jupiter v6, System Program]
Step 2 — Limits:    Max per-tx: 2 SOL, Daily budget: 20 SOL
Step 3 — Session:   Expires in 7 days
Step 4 — Escalation: None (no Squads multisig)
```

Alice clicks "Create Policy". Her Phantom wallet signs the `initialize_policy` transaction.

### Step 2: On-chain — PDAs created

The Guardrails program creates two PDAs:

**PermissionPolicy** (seeds: `["policy", Alice, AlphaScanner]`)
```
owner:               Alice (7xKX...AsU)
agent:               Alpha Scanner (J2HH...QAA)
allowed_programs:    [Jupiter v6, System Program]
max_tx_lamports:     2,000,000,000  (2 SOL)
daily_budget_lamports: 20,000,000,000  (20 SOL)
session_expiry:      2026-04-28T00:00:00Z
is_active:           true
authorized_monitors: [Monitor (9WzD...WWM)]
anomaly_score:       0
```

**SpendTracker** (seeds: `["tracker", policyPubkey]`)
```
lamports_spent_24h:  0
txn_count_24h:       0
window_start:        2026-04-21T00:00:00Z
```

Alice also adds the Monitor's pubkey as an authorized monitor via `update_policy`.

### Step 3: Fund the policy PDA

The policy PDA is the signer authority for the agent's actions. For the agent to spend SOL or swap tokens, the **policy PDA must hold the funds** — not the agent's keypair, not Alice's wallet.

**Funding SOL:**

Alice sends SOL to the policy PDA address via a standard System Program transfer from her wallet:

```
Alice's wallet → System Program transfer → Policy PDA (CsZ5...qeE)
                 amount: 20 SOL
```

This is a simple SOL transfer — no Guardrails instruction needed. Alice just sends SOL to the PDA's address like any normal transfer.

**Funding SPL tokens (e.g., USDC for Jupiter swaps):**

Alice creates an Associated Token Account (ATA) owned by the policy PDA, then transfers tokens into it:

```
1. Create ATA:
   owner = Policy PDA (CsZ5...qeE)
   mint  = USDC mint address
   → ATA address derived from (PDA, USDC mint)

2. Transfer tokens:
   Alice's USDC ATA → spl-token transfer → Policy PDA's USDC ATA
   amount: 1000 USDC
```

Now when the agent calls `guarded_execute` to do a Jupiter swap, the program CPIs to Jupiter with the policy PDA as signer. Jupiter moves tokens from the PDA's token account.

**Key insight:** The agent instructs, the PDA acts, the PDA holds the funds. The agent's keypair never touches the money directly.

```
┌─────────────┐    signs     ┌─────────────────┐  CPI (PDA signs)  ┌──────────┐
│ Agent key   │ ──────────→  │ guarded_execute  │ ───────────────→  │ Jupiter  │
│ (J2HH..QAA) │              │ (validates policy)│                   │ (swaps)  │
└─────────────┘              └─────────────────┘                   └──────────┘
                                      │                                  │
                              reads policy PDA                   moves tokens from
                              checks limits                      PDA's token account
```

---

## Phase 3: Normal Operation (T+0s to T+60s)

Alpha Scanner starts running — doing legitimate Jupiter swaps within its policy.

### How the agent calls Guardrails

The agent process (running on a server somewhere) builds and signs transactions using its session keypair. It never calls Jupiter directly — every call goes through `guarded_execute`:

```typescript
// Inside the agent process
const agentKeypair = loadSessionKey(); // J2HH...QAA

// Derive the policy PDA
const [policyPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("policy"), ownerPubkey.toBuffer(), agentKeypair.publicKey.toBuffer()],
  GUARDRAILS_PROGRAM_ID,
);

// Call guarded_execute — NOT Jupiter directly
const tx = await program.methods
  .guardedExecute(
    jupiterProgramId,          // target_program
    jupiterInstructionData,    // instruction_data (the actual swap)
    jupiterAccountMetas,       // account_metas (reconstructed for CPI)
    new BN(500_000_000),       // amount_hint (0.5 SOL)
  )
  .accounts({
    policy: policyPda,
    spendTracker: spendTrackerPda,
    agent: agentKeypair.publicKey,
    targetProgram: jupiterProgramId,
    clock: SYSVAR_CLOCK_PUBKEY,
  })
  .remainingAccounts(jupiterAccountMetas) // pass-through for CPI
  .signers([agentKeypair])                // agent signs the outer txn
  .rpc();
```

The Guardrails program validates the policy, then CPIs to Jupiter with the **policy PDA as signer** (via `invoke_signed`). Jupiter sees the PDA as the authority — not the agent.

### Transaction 1: Normal swap (T+10s)

**Agent sends:** `guarded_execute` with:
```
target_program: Jupiter v6
amount_hint:    500,000,000 (0.5 SOL)
instruction_data: [Jupiter swap USDC→SOL]
```

**On-chain validation (12 steps):**
```
1. ✅ Load PermissionPolicy PDA
2. ✅ is_active == true
3. ✅ session not expired (6 days 23h remaining)
4. ✅ Jupiter v6 ∈ allowed_programs
5. ✅ 0.5 SOL <= 2 SOL per-tx cap
6. ✅ Window still valid (same day)
7. ✅ 0.5 SOL + 0 <= 20 SOL daily budget
8. — No escalation (no Squads configured)
9. → Emit GuardedTxnAttempted event
10. → CPI to Jupiter v6 (signed by policy PDA)
11. ✅ CPI success → SpendTracker: spent = 0.5 SOL, count = 1
12. → Emit GuardedTxnExecuted event
```

**Helius picks up the event → POSTs to server webhook**

### Server pipeline

```
[ingest]
  ✅ HMAC verified
  → Parse: policy=CsZ5..., program=Jupiter, amount=0.5 SOL, sig=6EfG...
  → INSERT INTO guarded_txns (policyPubkey, txnSig, targetProgram, amountLamports, status='executed')
  → SSE emit "new_transaction" → dashboard shows new row in ActivityFeed

[prefilter]
  Checking signals:
  - Jupiter is most-used program ✅ (no signal)
  - 0.5 SOL = 25% of 2 SOL cap ✅ (< 50%, no signal)
  - 1 txn in 60s ✅ (< 3, no signal)
  - 9:10 UTC within ±2h of median ✅ (no signal)

  → signals = [] (empty)
  → SKIP LLM. Record prefilter-skipped allow verdict.
  → SSE emit "verdict" {verdict: "allow", prefilterSkipped: true}

[judge] — skipped (prefilter cleared it)
[executor] — skipped (not a pause)
[reporter] — skipped (no incident)
```

**Dashboard:** New row appears in ActivityFeed: `[ALLOW ✓] Jupiter v6 | 0.5 SOL | just now`

This repeats for two more normal transactions over the next 50 seconds.

---

## Phase 4: Attack Begins (T+60s)

Alpha Scanner's session key is compromised. The attacker starts draining funds to an unknown program.

### Transaction 4: First suspicious (T+60s)

**Agent sends:** `guarded_execute` with:
```
target_program: DezX...B263  ← NOT in allowed_programs!
amount_hint:    1,800,000,000 (1.8 SOL — 90% of cap)
```

**On-chain validation:**
```
1. ✅ Load policy
2. ✅ is_active == true
3. ✅ session not expired
4. ❓ DezX...B263 — wait, is this in allowed_programs?
```

**Important:** For MVP, the on-chain program checks the allow-list. If the program is NOT whitelisted, it rejects with `ProgramNotWhitelisted`. But in the demo, the attacker might be using a whitelisted program (Jupiter) with unusual parameters, or the allow-list might be broader. For the demo narrative, let's say this txn uses Jupiter but with suspicious patterns (unusual destination, high amount, rapid timing).

**On-chain:** Transaction executes (Jupiter is whitelisted, amount is within cap). SpendTracker updated.

**Server pipeline:**

```
[ingest]
  → INSERT guarded_txns
  → SSE emit "new_transaction"

[prefilter]
  Checking signals:
  - Jupiter is most-used program ✅ (no signal)
  - 1.8 SOL = 90% of cap ❌ → signal: "high_amount" (> 70%)
  - 4 txns in 60s ❌ → signal: "elevated_frequency" (>= 3)

  → signals = ["high_amount", "elevated_frequency"]
  → INVOKE LLM (signals not empty)

[judge]
  → Build JudgeContext:
    - Policy: Jupiter + System, cap 2 SOL, budget 20 SOL (35% used today)
    - Txn: Jupiter, 1.8 SOL, 90% of cap
    - History: 3 normal txns (0.5, 0.8, 0.4 SOL) over 50 mins
    - Baseline: median 0.57 SOL, p95 0.8 SOL
    - Signals: high_amount, elevated_frequency

  → Claude Haiku responds (1.58s):
    {
      "verdict": "flag",
      "confidence": 72,
      "reasoning": "Amount 3x above median + frequency spike. Monitoring.",
      "signals": ["high_amount", "3x_median", "frequency_spike"]
    }

  → INSERT anomaly_verdicts (verdict=flag, confidence=72)
  → SSE emit "verdict" → dashboard shows yellow FLAG badge

[executor] — skipped (flag, not pause)
```

**Dashboard:** Row turns yellow: `[FLAG ⚠] Jupiter v6 | 1.8 SOL | just now`
Expanding shows: *"Amount 3x above median + frequency spike. Monitoring."*

### Transaction 5: Second suspicious (T+62s)

Same pattern, 1.9 SOL. Claude responds:

```json
{
  "verdict": "flag",
  "confidence": 65,
  "reasoning": "Burst: 2 txns in 2s, amount at 95% of cap. Elevated risk.",
  "signals": ["burst_2_in_2s", "near_cap", "escalating_amounts"]
}
```

**Dashboard:** Another yellow row.

### Transaction 6: Drain confirmed (T+65s)

1.95 SOL to same destination, 3rd txn in 5 seconds. Claude sees the pattern:

```json
{
  "verdict": "pause",
  "confidence": 94,
  "reasoning": "Draining sequence confirmed: 3 txns in 5s, escalating amounts approaching cap.",
  "signals": ["drain_sequence", "burst_3_in_5s", "escalating_to_cap"]
}
```

---

## Phase 5: Kill Switch (T+65s)

### Server executor

```
[executor]
  Verdict is "pause" → execute kill switch

  1. Sign pause_agent instruction:
     program.methods.pauseAgent(reason)
       .accounts({ policy: CsZ5..., monitor: 9WzD...WWM })
       .signers([MONITOR_KEYPAIR])
       .rpc({ commitment: "confirmed" })

  2. INSERT INTO incidents:
     {
       policyPubkey: "CsZ5...",
       pausedAt: "2026-04-21T15:00:06Z",
       pausedBy: "9WzD...WWM",
       reason: "Draining sequence confirmed",
       triggeringTxnSig: "2KlM...",
       judgeVerdictId: "d4e5..."
     }

  3. SSE emit "agent_paused" → dashboard shows red alert

  4. Fire-and-forget: generateReport(incidentId, policyPubkey)
```

### On-chain state after pause

**PermissionPolicy:**
```
is_active:    false  ← PAUSED
paused_by:    Monitor (9WzD...WWM)
paused_reason: "Draining sequence confirmed..."
anomaly_score: 94
```

**Any further `guarded_execute` calls by Alpha Scanner immediately fail** at step 2 with `PolicyPaused` error. The attacker is locked out.

### Dashboard update (via SSE)

Three things happen instantly:
1. `agent_paused` event → incident prepended to `["incidents"]` cache
2. Policy marked inactive in `["policies"]` cache → PolicyCard turns red
3. ActivityFeed shows the pause event

```
[PAUSE ✕] Agent paused by monitor | just now
```

Alert banner appears: "Alpha Scanner has been paused."

---

## Phase 6: Incident Report (T+70s)

### Server reporter (async, non-blocking)

```
[reporter]
  1. Fetch 24h of txn history for Alpha Scanner
  2. Fetch all verdicts for those txns
  3. Fetch the triggering incident

  4. Call Claude Opus:
     "Generate a postmortem for this agent pause..."

  5. Opus returns (~15 seconds):
     # Incident Report — Alpha Scanner

     ## Summary
     Agent paused after 3 transactions in 5 seconds to Jupiter
     with escalating amounts approaching the 2 SOL cap...

     ## Timeline
     | Time     | Event                    | Detail                          |
     |----------|--------------------------|----------------------------------|
     | 09:10:00 | Normal txn               | Jupiter swap, 0.5 SOL — allowed |
     | 12:00:00 | Normal txn               | Jupiter swap, 0.8 SOL — allowed |
     | 15:00:00 | ⚠️ Suspicious            | 1.8 SOL (90% of cap) — FLAG     |
     | 15:00:02 | ⚠️ Suspicious            | 1.9 SOL (95% of cap) — FLAG     |
     | 15:00:05 | 🛑 Draining              | 1.95 SOL — PAUSE (94%)          |
     | 15:00:06 | Agent paused             | Monitor executed pause_agent     |

     ## Anomaly Signals
     - Escalating amounts: 1.8 → 1.9 → 1.95 SOL
     - Burst: 3 txns in 5 seconds (baseline: 1 txn per 20 min)
     - All targeting same destination

     ## Recommended Policy Changes
     1. Rotate the agent session key
     2. Reduce per-tx cap from 2 SOL to 1 SOL
     3. Tighten burst threshold to 2 txns in 30s

  6. UPDATE incidents SET fullReport = <markdown> WHERE id = <incidentId>
  7. SSE emit "report_ready" { incidentId, fullReport }
```

### Dashboard update (via SSE)

`report_ready` event patches the report into the cached incident. The `/incidents/[id]` page now shows the full Opus postmortem rendered as markdown.

---

## Phase 7: Resolution

Alice sees the incident on her dashboard. She reviews the Opus report, rotates the agent's session key via `rotate_agent_key`, tightens the policy limits via `update_policy`, and then calls `resume_agent` from her wallet.

The policy is back to `is_active: true` with a new agent session key and stricter limits. The old key is permanently locked out.

---

## Complete Data Flow Diagram

```
T+10s  Agent → guarded_execute → On-chain OK → Helius → Server
                                                          ├─ ingest → DB + SSE "new_transaction"
                                                          ├─ prefilter → signals=[] → SKIP
                                                          └─ verdict "allow" → SSE "verdict"
                                                                                ↓
                                                                        Dashboard: green ✓

T+60s  Agent → guarded_execute → On-chain OK → Helius → Server
                                                          ├─ ingest → DB + SSE "new_transaction"
                                                          ├─ prefilter → signals=[high_amount]
                                                          ├─ judge → Claude Haiku → "flag" 72%
                                                          └─ verdict → DB + SSE "verdict"
                                                                                ↓
                                                                        Dashboard: yellow ⚠

T+65s  Agent → guarded_execute → On-chain OK → Helius → Server
                                                          ├─ ingest → DB + SSE "new_transaction"
                                                          ├─ prefilter → signals=[burst, high_amount]
                                                          ├─ judge → Claude Haiku → "pause" 94%
                                                          ├─ executor → pause_agent on-chain
                                                          │            → DB incident + SSE "agent_paused"
                                                          └─ reporter → Claude Opus (async)
                                                                       → DB update + SSE "report_ready"
                                                                                ↓
                                                                        Dashboard: red ✕ + report

T+66s  Agent → guarded_execute → On-chain REJECT (PolicyPaused)
       ↑ attacker is locked out
```

---

## Key Timings

| Event | Time from attack start |
|-------|----------------------|
| First suspicious txn | T+0s |
| First FLAG verdict | T+0s + ~1.5s (Claude latency) |
| Drain pattern confirmed | T+5s |
| PAUSE verdict | T+5s + ~1.2s |
| On-chain pause executed | T+5s + ~2s (Solana confirmation) |
| **Agent fully locked out** | **~7 seconds from first suspicious txn** |
| Opus incident report ready | T+5s + ~20s |

---

## What each layer prevented

| Layer | What it catches | Example |
|-------|----------------|---------|
| **On-chain allow-list** | Calls to non-whitelisted programs | Attacker tries to call a token drain program → `ProgramNotWhitelisted` |
| **On-chain budget** | Spending above limits | Single txn > 2 SOL → `AmountExceedsLimit`. Daily total > 20 SOL → `DailyBudgetExceeded` |
| **On-chain session expiry** | Using expired keys | Session key used after expiry → `SessionExpired` |
| **AI judge (prefilter)** | Statistical anomalies | Burst > 5 txns/min, amount > 70% of cap, unusual hours |
| **AI judge (Claude)** | Behavioral patterns | Draining sequences, escalating amounts, new destinations |
| **Kill switch** | Immediate halt | Judge says PAUSE → agent frozen on-chain in seconds |
| **Squads escalation** | High-value oversight | Amount > threshold → requires multisig approval |

Three layers of defense. The on-chain program is the first wall. The AI judge is the second. The kill switch is the emergency brake. Together, they contain a compromised agent before significant damage occurs.
