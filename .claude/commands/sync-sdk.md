Run the SDK sync pipeline and verify the result.

Steps:
1. Check if `program/target/idl/guardrails.json` exists. If it does, compare it with `sdk/idl/guardrails.json` and report if the IDL has changed.
2. Run `bash scripts/sync-sdk.sh` to sync the SDK to both consumers.
3. Verify the sync by running `diff -rq sdk/ server/src/sdk/` and `diff -rq sdk/ dashboard/lib/sdk/`. Report any differences.
4. Stage the synced files with `git add server/src/sdk/ dashboard/lib/sdk/ sdk/`.
5. Report a summary of what changed.
