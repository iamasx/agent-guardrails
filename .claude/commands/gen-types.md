Regenerate TypeScript types from the Anchor IDL and Supabase schema.

Steps:
1. If `program/target/idl/guardrails.json` exists, copy it to `sdk/idl/guardrails.json`.
2. Run `bash scripts/sync-sdk.sh` to propagate the IDL to consumers.
3. Check if Supabase is running locally (`npx supabase status`). If yes:
   - Run `npx supabase gen types typescript --local` and write output to `worker/src/types/db.ts`.
   - Copy the same output to `dashboard/lib/types/db.ts`.
4. Report what type files were updated.
