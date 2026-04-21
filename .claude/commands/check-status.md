Scan the project and report what is implemented vs still a stub.

Steps:
1. Scan all `.rs` files in `program/programs/guardrails/src/` — for each file, check if it contains only TODO comments or has real implementation code. Report: filename | status (stub/implemented).
2. Scan all `.ts` files in `server/src/` (excluding `server/src/sdk/` and `server/src/types/`) — same check. Report: filename | status.
3. Scan all page files in `dashboard/app/` — check if each page has real UI or just a placeholder div. Report: route | status.
4. Check `dashboard/components/` — list any real components vs just .gitkeep.
5. Check if `.env` exists in `server/` and `.env.local` exists in `dashboard/` (not the .example files).
6. Check if `program/target/` exists (has anchor build been run?).
7. Check if `server/prisma/migrations/` has any migration files (has prisma migrate been run?).
8. Run `git status` for uncommitted changes.
9. Print a summary: "X/Y program instructions implemented, X/Y server modules implemented, X/Y dashboard pages implemented".
