Build every component and report pass/fail — mimics what CI checks before push.

Steps:
1. Run `bash scripts/sync-sdk.sh` to ensure SDK is synced.
2. Run `cd program && anchor build` — report pass/fail.
3. Run `cd server && pnpm install && pnpm build` — report pass/fail.
4. Run `cd dashboard && npm install && NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID=11111111111111111111111111111111 NEXT_PUBLIC_API_URL=http://localhost:8080 npm run build` — report pass/fail.
5. Verify SDK sync: `diff -rq sdk/ server/src/sdk/` and `diff -rq sdk/ dashboard/lib/sdk/`.
6. Print a summary table: component | status | errors (if any).
