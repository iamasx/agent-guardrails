# Deployment Guide

Deploy order matters: **Program → Server → Dashboard**

Each depends on the previous for configuration values.

---

## 1. Program → Solana Devnet

```bash
cd program

# Build
anchor build

# Get the program ID
solana address -k target/deploy/guardrails-keypair.json

# Update program ID in:
#   - Anchor.toml: [programs.devnet] guardrails = "<ID>"
#   - programs/guardrails/src/lib.rs: declare_id!("<ID>")

# Rebuild with correct ID
anchor build

# Fund your wallet
solana airdrop 5 --url devnet

# Deploy
anchor deploy --provider.cluster devnet

# Sync IDL to SDK
cd ..
bash scripts/sync-sdk.sh
```

**Via GitHub Actions:** Go to Actions → "Deploy — Program" → Run workflow → type "deploy". Requires `SOLANA_DEPLOY_KEYPAIR` secret (base64-encoded keypair JSON).

---

## 2. Database → Neon Postgres

1. Create a project at [neon.tech](https://neon.tech)
2. Note the pooled and direct connection strings
3. Run migrations:

```bash
cd server
DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npx prisma migrate deploy
```

---

## 3. Server → Railway/Fly.io

### Option A: Railway

```bash
cd server

# Install Railway CLI
npm install -g @railway/cli

# Login and create project
railway login
railway init

# Set environment variables
railway variables set \
  PORT=8080 \
  SOLANA_RPC_URL="https://devnet.helius-rpc.com/?api-key=<KEY>" \
  GUARDRAILS_PROGRAM_ID="<from step 1>" \
  MONITOR_KEYPAIR="<base64-encoded keypair>" \
  HELIUS_WEBHOOK_SECRET="<from Helius dashboard>" \
  ANTHROPIC_API_KEY="<your key>" \
  DATABASE_URL="<from step 2, pooled>" \
  DIRECT_URL="<from step 2, direct>" \
  JWT_SECRET="<random secret>" \
  CORS_ORIGIN="https://guardrails.vercel.app"

# Deploy
railway up
```

### Option B: Fly.io

```bash
cd server

# First time: create the app
fly launch --no-deploy

# Set secrets (never in code)
fly secrets set \
  SOLANA_RPC_URL="https://devnet.helius-rpc.com/?api-key=<KEY>" \
  GUARDRAILS_PROGRAM_ID="<from step 1>" \
  MONITOR_KEYPAIR="<base64-encoded keypair>" \
  HELIUS_WEBHOOK_SECRET="<from Helius dashboard>" \
  ANTHROPIC_API_KEY="<your key>" \
  DATABASE_URL="<from step 2, pooled>" \
  DIRECT_URL="<from step 2, direct>" \
  JWT_SECRET="<random secret>" \
  CORS_ORIGIN="https://guardrails.vercel.app"

# Deploy
fly deploy
```

Note the deployed URL (e.g., `https://guardrails-server.fly.dev`).

---

## 4. Helius Webhook

After server is deployed:

1. Go to Helius webhook dashboard
2. Create webhook:
   - **URL:** `https://<your-server-url>/webhook`
   - **Transaction type:** ANY
   - **Account addresses:** Your deployed program ID
3. Copy the webhook secret → set as `HELIUS_WEBHOOK_SECRET` in server secrets

---

## 5. Dashboard → Vercel

Connect the GitHub repo to Vercel:

1. Import project at vercel.com/new
2. Set **Root Directory** to `dashboard`
3. Framework preset: Next.js (auto-detected)
4. Add environment variables:
   - `NEXT_PUBLIC_SOLANA_RPC_URL` = Helius devnet RPC URL
   - `NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID` = from step 1
   - `NEXT_PUBLIC_API_URL` = server URL from step 3 (e.g., `https://guardrails-server.fly.dev`)
5. Deploy

Vercel auto-deploys on push to main. Configure **Ignored Build Step** to skip builds when only `program/` or `server/` change:
```bash
git diff --quiet HEAD^ HEAD -- dashboard/
```
