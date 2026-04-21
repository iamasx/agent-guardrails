# Local Environment Setup

Get the full stack running locally in ~15 minutes.

## Prerequisites

```bash
# Rust + Solana + Anchor
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.26/install)"
npm install -g @coral-xyz/anchor-cli@0.30.1

# Node.js 20+ and pnpm
node --version   # must be 20+
npm install -g pnpm@9

# Docker (for Supabase local)
docker --version  # must be running

# Solana keypair
solana-keygen new --no-bip39-passphrase  # skip if you already have one
```

## Step 1: Clone and Build Program

```bash
git clone https://github.com/iamasx/agent-guardrails.git
cd agent-guardrails

# Configure git hooks
git config core.hooksPath .githooks

# Build the Anchor program
cd program
anchor build
cd ..

# Sync the IDL to consumers
bash scripts/sync-sdk.sh
```

## Step 2: Start Local Solana Validator (Terminal 1)

```bash
solana-test-validator
```

Leave this running. Default RPC: `http://localhost:8899`

## Step 3: Deploy Program Locally

```bash
cd program
anchor deploy --provider.cluster localnet
# Note the program ID from the output
cd ..
```

Update the program ID in:
- `program/Anchor.toml` → `[programs.devnet]` value
- `program/programs/guardrails/src/lib.rs` → `declare_id!()`
- `worker/.env` → `GUARDRAILS_PROGRAM_ID`
- `dashboard/.env.local` → `NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID`

## Step 4: Start Supabase (Terminal 2)

```bash
npx supabase start
```

Note the output values:
- **API URL** → `http://localhost:54321`
- **anon key** → for dashboard
- **service_role key** → for worker

Run migrations once they exist:
```bash
npx supabase db reset
```

## Step 5: Configure Worker Environment

```bash
cp worker/.env.example worker/.env
```

Edit `worker/.env`:
```
SOLANA_RPC_URL=http://localhost:8899
GUARDRAILS_PROGRAM_ID=<from step 3>
MONITOR_KEYPAIR=~/.config/solana/id.json
HELIUS_WEBHOOK_SECRET=local-dev-secret
ANTHROPIC_API_KEY=<your Anthropic key>
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE=<from step 4>
```

## Step 6: Start Worker (Terminal 3)

```bash
cd worker
pnpm install
pnpm dev
```

Runs on `http://localhost:8080`. On localnet there's no Helius — POST mock webhook payloads to test.

## Step 7: Configure and Start Dashboard (Terminal 4)

```bash
cp dashboard/.env.example dashboard/.env.local
```

Edit `dashboard/.env.local`:
```
NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899
NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID=<from step 3>
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from step 4>
SUPABASE_SERVICE_ROLE=<from step 4>
```

```bash
cd dashboard
npm install
npm run dev
```

Dashboard at `http://localhost:3000`.

## Verify

1. Dashboard loads at localhost:3000
2. Worker responds at localhost:8080
3. `solana program show <PROGRAM_ID> --url localhost` shows the deployed program
4. Supabase Studio at `http://localhost:54323`
