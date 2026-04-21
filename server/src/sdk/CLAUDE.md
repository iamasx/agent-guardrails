# SDK — Source of Truth

This directory is the SINGLE source of truth for the TypeScript client and Anchor IDL.

## Files

- `idl/guardrails.json` — Anchor-generated IDL. Updated by `scripts/sync-sdk.sh` from `program/target/idl/guardrails.json` after `anchor build`. Never edit manually.
- `client.ts` — GuardrailsClient class wrapping the Anchor program client.
- `types.ts` — SDK types derived from the IDL.

## How it's consumed

`scripts/sync-sdk.sh` does a full `cp -r` of this directory to:
- `worker/src/sdk/`
- `dashboard/lib/sdk/`

The pre-commit hook auto-runs this when `sdk/` or `program/` files are staged.

## Rules

- Every change here MUST be synced before testing in worker or dashboard
- Do not add files only relevant to one consumer — this directory is shared
- The client must work in both ESM (worker) and bundler (Next.js) contexts
- Use only `@coral-xyz/anchor` and `@solana/web3.js` — both available in both consumers
- Do not manually edit `idl/guardrails.json` — it is auto-generated
