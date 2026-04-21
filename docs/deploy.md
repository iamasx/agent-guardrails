# Deployment Guide

Deploy order matters: **Program → Worker → Dashboard**

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

## 2. Worker → Fly.io

```bash
cd worker

# First time: create the app
fly launch --no-deploy

# Set secrets (never in code)
fly secrets set \
  SOLANA_RPC_URL="https://devnet.helius-rpc.com/?api-key=<KEY>" \
  GUARDRAILS_PROGRAM_ID="<from step 1>" \
  MONITOR_KEYPAIR="<base64-encoded keypair>" \
  HELIUS_WEBHOOK_SECRET="<from Helius dashboard>" \
  ANTHROPIC_API_KEY="<your key>" \
  SUPABASE_URL="<your Supabase URL>" \
  SUPABASE_SERVICE_ROLE="<your service role key>"

# Deploy
fly deploy
```

Note the deployed URL (e.g., `https://guardrails-worker.fly.dev`). Configure this as the Helius webhook endpoint.

**Via GitHub Actions:** Auto-deploys on merge to main when `worker/` changes. Requires `FLY_API_TOKEN` secret.

---

## 3. Dashboard → Vercel

Connect the GitHub repo to Vercel:

1. Import project at vercel.com/new
2. Set **Root Directory** to `dashboard`
3. Framework preset: Next.js (auto-detected)
4. Add environment variables:
   - `NEXT_PUBLIC_SOLANA_RPC_URL` = Helius devnet RPC URL
   - `NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID` = from step 1
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = from Supabase dashboard
   - `SUPABASE_SERVICE_ROLE` = from Supabase dashboard
5. Deploy

Vercel auto-deploys on push to main. Configure **Ignored Build Step** to skip builds when only `program/` or `worker/` change:
```bash
git diff --quiet HEAD^ HEAD -- dashboard/
```

---

## 4. Helius Webhook

After worker is deployed:

1. Go to Helius webhook dashboard
2. Create webhook:
   - **URL:** `https://guardrails-worker.fly.dev/webhook` (your Fly.io URL)
   - **Transaction type:** ANY
   - **Account addresses:** Your deployed program ID
3. Copy the webhook secret → set as `HELIUS_WEBHOOK_SECRET` in Fly.io secrets

---

## 5. Supabase

1. Create project at supabase.com
2. Run migrations: `npx supabase db push --project-ref <ref>`
3. Enable Realtime on tables: `guarded_txns`, `incidents`
4. Configure RLS policies (users see only their own data)
5. Note the URL, anon key, and service role key for env vars
