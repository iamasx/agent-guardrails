Implement a section from the implementation plan.

Usage: /project:impl-section <section_number>
Example: /project:impl-section 3.1

Steps:
1. Read the relevant IMPLEMENTATION.md based on the section:
   - Program sections → `program/IMPLEMENTATION.md`
   - Server/pipeline sections → `server/IMPLEMENTATION.md`
   - Dashboard sections → `dashboard/IMPLEMENTATION.md`
   - High-level sections → `implementation-plan.md`
2. Read `docs/data-contracts.md` for the relevant data shapes.
3. Read `docs/architecture.md` to understand how this section fits in the system.
4. Identify which files need to be created or modified based on that section.
5. Read the current state of those files to understand what's already there.
6. Implement the section, following:
   - The types and patterns specified in the implementation plan
   - The conventions from the relevant CLAUDE.md (program/, server/, or dashboard/)
   - The data contracts from docs/data-contracts.md
7. If any `sdk/` files were touched, run `bash scripts/sync-sdk.sh`.
8. Build/type-check the modified component to verify the implementation compiles:
   - Program: `cd program && anchor build`
   - Server: `cd server && pnpm build`
   - Dashboard: `cd dashboard && npm run build`
9. Report what was implemented and any follow-up items.

$ARGUMENTS
