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

## Step 2: Run Program Tests

Tests use LiteSVM (in-process) — no external validator needed.

```bash
cd program
pnpm install
anchor test --skip-local-validator --skip-deploy
cd ..
```

## Step 3: Get the Program ID

After `anchor build` (run in Step 1), extract the program ID:

```bash
solana address -k program/target/deploy/guardrails-keypair.json
```

Update the program ID in:
- `program/Anchor.toml` → `[programs.devnet]` value
- `program/programs/guardrails/src/lib.rs` → `declare_id!()`
- Rebuild after updating: `cd program && anchor build && cd .. && bash scripts/sync-sdk.sh`

Later, set it in env files:
- `server/.env` → `GUARDRAILS_PROGRAM_ID`
- `dashboard/.env.local` → `NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID`

## Step 4: Set Up Database

Create a free Neon database at [neon.tech](https://neon.tech) (or use a local Postgres).

Note the connection strings:
- **Pooled connection** → for `DATABASE_URL`
- **Direct connection** → for `DIRECT_URL` (used by Prisma migrations)

Run migrations:
```bash
cd server
pnpm install
npx prisma migrate dev
cd ..
```

## Step 5: Configure and Start Server (Terminal 2)

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```
PORT=8080
SOLANA_RPC_URL=http://localhost:8899
GUARDRAILS_PROGRAM_ID=<from step 3>
MONITOR_KEYPAIR=~/.config/solana/id.json
HELIUS_WEBHOOK_SECRET=local-dev-secret
ANTHROPIC_API_KEY=<your Anthropic key>
DATABASE_URL=<from step 4, pooled>
DIRECT_URL=<from step 4, direct>
JWT_SECRET=local-dev-secret
CORS_ORIGIN=http://localhost:3000
```

```bash
cd server
pnpm install
pnpm dev
```

Server runs on `http://localhost:8080`. On localnet there's no Helius — POST mock webhook payloads to test.

## Step 6: Configure and Start Dashboard (Terminal 3)

```bash
cp dashboard/.env.example dashboard/.env.local
```

Edit `dashboard/.env.local`:
```
NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899
NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID=<from step 3>
NEXT_PUBLIC_API_URL=http://localhost:8080
```

```bash
cd dashboard
npm install
npm run dev
```

Dashboard at `http://localhost:3000`.

## Verify

1. Program tests pass: `cd program && anchor test --skip-local-validator --skip-deploy`
2. Server responds at localhost:8080
3. Dashboard loads at localhost:3000
4. Database tables exist: `cd server && npx prisma studio` (opens at localhost:5555)
