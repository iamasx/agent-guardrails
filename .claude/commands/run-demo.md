Set up and start all components for a local demo run.

Steps:
1. Verify prerequisites:
   - `program/target/` exists (program is built)
   - `server/node_modules/` exists (deps installed)
   - `dashboard/node_modules/` exists (deps installed)
   - `server/.env` exists
   - `dashboard/.env.local` exists
   Report any missing prerequisites and stop.

2. Start the server: run `cd server && pnpm dev` in the background.
3. Start the dashboard: run `cd dashboard && npm run dev` in the background.
4. Wait for both to be ready.
5. Report:
   - Server running at http://localhost:8080
   - Dashboard running at http://localhost:3000
6. Tell the user: "Run `cd dashboard && npm run demo:setup` to create the demo policy, then `npm run demo:simulate` to start the attack simulation."
