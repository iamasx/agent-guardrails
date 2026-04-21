Walk through the full Solana devnet deployment sequence for the program.

Steps:
1. Run `cd program && anchor build`.
2. Extract the program ID: `solana address -k program/target/deploy/guardrails-keypair.json`.
3. Read the current program ID in `program/Anchor.toml` and `program/programs/guardrails/src/lib.rs`. If either differs from the extracted ID, update them and rebuild.
4. Confirm with the user before deploying: "Deploy program <ID> to devnet? This requires a funded keypair."
5. Run `cd program && anchor deploy --provider.cluster devnet`.
6. Run `bash scripts/sync-sdk.sh` to propagate the new IDL.
7. Check if `worker/.env` and `dashboard/.env.local` exist — if so, update `GUARDRAILS_PROGRAM_ID` / `NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID` with the new ID.
8. Report the deployed program ID and suggest next steps.
