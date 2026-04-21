Build and test the Anchor program with diagnostics on failure.

Steps:
1. Run `cd program && anchor build`. If build fails, read the error output and the relevant source file to diagnose.
2. Run `cd program && anchor test`. This starts a local validator automatically.
3. If tests fail:
   - Read `program/tests/guardrails.ts` to understand what was being tested.
   - Read the relevant instruction source file in `program/programs/guardrails/src/instructions/`.
   - Diagnose the failure and suggest a fix.
4. Report which tests passed and which failed with error details.
