# Demo Runbook

Operator's guide for running the 3-minute hackathon demo. Use when rehearsing or on demo day.

---

## Pre-Demo Checklist

- [ ] Program deployed on devnet — `solana program show <PROGRAM_ID> --url devnet`
- [ ] Server running on Railway/Fly.io — `curl https://<server-url>/webhook` (should return 405)
- [ ] Dashboard live on Vercel — open in browser
- [ ] Neon database has tables — `cd server && npx prisma studio`
- [ ] Helius webhook configured and pointing to server URL
- [ ] Demo keypairs funded — `solana balance <KEYPAIR> --url devnet` (need ~5 SOL each)
- [ ] Demo policy created — `cd dashboard && npm run demo:setup`
- [ ] Backup demo recording uploaded (in case of live failure)

---

## Running the Demo

### Terminal 1: Start the simulation

```bash
cd dashboard
npm run demo:simulate
```

This runs:
- **T+0s:** Starts trader-agent (Jupiter swaps, ~30 txns/hour) + staker-agent (Marinade)
- **T+60s:** Starts attacker agent (burst swaps, unfamiliar programs, drain attempt)

### On the Dashboard

1. Open `/agents` — show three agents running, all green
2. Open one agent detail — show spend gauge ticking up, activity feed streaming
3. Wait for attacker to trigger (~T+65s):
   - First suspicious txn appears **yellow** (FLAG) in activity feed
   - Claude's reasoning visible inline: "new program + 3x median amount + 4 txns in 8s"
   - Second txn triggers **red** (PAUSE) — agent stops instantly
4. Click into `/incidents` — show the paused incident
5. Open incident detail — show Opus-generated postmortem with timeline

### Expected Timing (ideal conditions — Claude API <2s latency)

| Time | Event |
|---|---|
| T+0s | Trader + staker start, normal activity streams in |
| T+60s | Attacker starts burst-swapping |
| T+62s | First FLAG verdict from Claude |
| T+63s | PAUSE verdict — on-chain pause executed |
| T+65s | Incident appears in dashboard (via SSE) |
| T+70s | Opus incident report generates (via SSE) |

**Note:** If Claude API latency spikes >3s, the pause may take longer. Do dry runs to calibrate timing before demo day.

---

## Demo Script (What to Say)

**0:00–0:20 — Hook:** "Step Finance lost $40M because a treasury wallet with full permissions was compromised. Today, 250,000 AI agents operate on Solana with the same risk."

**0:20–0:50 — What we built:** "Agent Guardrails Protocol — an on-chain policy layer. Three enforcement layers: allow-listing, budget, kill switch." Show architecture diagram.

**0:50–1:30 — Live demo:** Dashboard on screen. Three agents, activity feed, spend gauges. Everything green.

**1:30–2:15 — Attack:** Attacker starts. First txn flagged yellow. Claude reasoning inline. Second txn: PAUSE. Agent stops. On-chain event in explorer.

**2:15–2:40 — Incident view:** Opus postmortem. Timeline. Judge reasoning chain.

**2:40–3:00 — Close:** "Built on Swig session keys, Squads multisig, Helius streams. Open source, devnet-live today."

---

## Fallback Procedures

### Devnet is slow/congested
- Switch to the pre-recorded demo video
- Or use localnet: run a local validator and adjust RPC URLs

### Server is down
- Check logs: `fly logs -a guardrails-server` or Railway dashboard
- Restart: `fly machine restart -a guardrails-server` or redeploy on Railway

### Claude API latency > 3s
- Server falls back to rule-based verdict (if implemented)
- Narrate: "In production, the 3-second timeout triggers a rule-based fallback"

### Dashboard won't load
- Show Prisma Studio (`npx prisma studio`) as proof of data in the database
- Show Solana Explorer for on-chain events

### Demo agents fail to connect
- Verify devnet SOL balance: `solana airdrop 5 --url devnet`
- Verify program ID matches in demo script env
