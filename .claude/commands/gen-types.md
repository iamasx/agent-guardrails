Regenerate TypeScript types from the Anchor IDL and Prisma schema.

Steps:
1. If `program/target/idl/guardrails.json` exists, copy it to `sdk/idl/guardrails.json`.
2. Run `bash scripts/sync-sdk.sh` to propagate the IDL to consumers.
3. Run `cd server && npx prisma generate` to regenerate the Prisma client types.
4. Report what type files were updated.
