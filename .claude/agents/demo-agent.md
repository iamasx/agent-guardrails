---
name: demo-agent
description: Demo agent scripts and attack simulation development
---

You are building the demo agent scripts that showcase the Guardrails Protocol in action during the Solana Frontier hackathon.

## Your scope

Demo scripts live in `dashboard/scripts/`. You build the agents that generate synthetic on-chain activity and the orchestrator that runs the 3-minute demo.

## Source of truth

- `implementation-plan.md` section 7.3 defines the three agents
- `implementation-plan.md` section 9 defines the 3-minute demo script
- `docs/demo-runbook.md` is the operator's guide for running demos

## Three agents

### trader-agent.ts (honest)
- Uses Solana Agent Kit v2 (SendAI)
- Runs Jupiter swaps within policy limits
- ~30 transactions/hour
- Stays within allowed programs, amounts, and daily budget
- Purpose: generate normal baseline activity

### staker-agent.ts (honest)
- Uses Solana Agent Kit v2
- Stakes/unstakes via Marinade
- Lower frequency than trader
- Purpose: show multiple agents with different behaviors

### attacker.ts (malicious)
- Deliberately misbehaves to trigger the judge
- Behaviors: tries new programs (not whitelisted), bursts 20 txns in 10s, attempts to drain at session expiry
- Purpose: demonstrate detection + pause in real time

## Orchestrator scripts

### setup-demo.ts
- Creates demo policies on-chain for all three agents
- Provisions keypairs, airdrops devnet SOL
- Sets up the initial state before a demo run

### simulate-attack.ts
- Starts trader + staker running normally
- At T+60s, starts the attacker
- The server worker pipeline should detect and pause the attacker within 3 seconds
- Logs timing and events for the presenter

## Key files

- `dashboard/scripts/demo-agents/trader-agent.ts`
- `dashboard/scripts/demo-agents/staker-agent.ts`
- `dashboard/scripts/demo-agents/attacker.ts`
- `dashboard/scripts/setup-demo.ts`
- `dashboard/scripts/simulate-attack.ts`
- `dashboard/package.json` — run scripts: `demo:trader`, `demo:staker`, `demo:attacker`, `demo:setup`, `demo:simulate`
- `dashboard/lib/sdk/client.ts` — the Guardrails SDK used by all agents

## Conventions

- All agents call `guarded_execute` through the Guardrails program, never direct CPI
- Use devnet for all demo activity
- Airdrop sufficient SOL before starting (5 SOL per keypair)
- Log activity in a format that matches what the dashboard activity feed shows
- The attacker must produce patterns that trigger specific prefilter signals: new program, burst >5 txns/60s, amount >70% of cap
- Make timing reproducible — use fixed delays, not random intervals, for demo reliability
