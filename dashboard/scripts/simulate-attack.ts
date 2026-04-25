// simulate-attack.ts — Orchestrates the full demo: trader + staker run normally,
// attacker triggers at T+60s. Designed for the 3-minute hackathon demo.
// Run: cd dashboard && npm run demo:simulate

import { ChildProcess, fork } from "child_process";
import * as path from "path";
import { loadDemoKeys, keypairFromArray, getClient, sleep } from "./demo-helpers";

const ATTACKER_DELAY_MS = 60_000; // Start attacker 60s after honest agents
const DEMO_TOTAL_MS = 180_000;    // Total demo window: 3 minutes

function startAgent(scriptName: string): ChildProcess {
  const scriptPath = path.join(__dirname, "demo-agents", scriptName);
  const child = fork(scriptPath, [], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env },
  });

  const label = scriptName.replace(".ts", "").replace("-agent", "");

  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(data);
  });

  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(data);
  });

  child.on("exit", (code) => {
    console.log(`[simulate] ${label} agent exited (code ${code})`);
  });

  return child;
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║     Agent Guardrails — Live Demo Simulation     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Verify keys exist
  const keys = loadDemoKeys();
  const owner = keypairFromArray(keys.owner);
  const trader = keypairFromArray(keys.trader);
  const staker = keypairFromArray(keys.staker);
  const attacker = keypairFromArray(keys.attacker);

  const client = getClient(owner);
  const [traderPda] = client.findPolicyPda(owner.publicKey, trader.publicKey);
  const [stakerPda] = client.findPolicyPda(owner.publicKey, staker.publicKey);
  const [attackerPda] = client.findPolicyPda(owner.publicKey, attacker.publicKey);

  console.log("[simulate] Policies:");
  console.log(`  Trader:   ${traderPda.toBase58()}`);
  console.log(`  Staker:   ${stakerPda.toBase58()}`);
  console.log(`  Attacker: ${attackerPda.toBase58()}`);

  // -------------------------------------------------------------------------
  // T+0s: Start honest agents
  // -------------------------------------------------------------------------

  const t0 = Date.now();
  const elapsed = () => `T+${Math.floor((Date.now() - t0) / 1000)}s`;

  console.log(`\n[simulate] ${elapsed()} Starting trader + staker agents…\n`);

  const children: ChildProcess[] = [];
  children.push(startAgent("trader-agent.ts"));
  children.push(startAgent("staker-agent.ts"));

  // -------------------------------------------------------------------------
  // T+60s: Start attacker
  // -------------------------------------------------------------------------

  console.log(`[simulate] Attacker will start in ${ATTACKER_DELAY_MS / 1000}s…\n`);
  await sleep(ATTACKER_DELAY_MS);

  console.log(`\n[simulate] ${elapsed()} ⚠ Starting attacker agent…\n`);
  children.push(startAgent("attacker.ts"));

  // -------------------------------------------------------------------------
  // Wait for demo window or attacker to finish
  // -------------------------------------------------------------------------

  const remaining = DEMO_TOTAL_MS - (Date.now() - t0);
  if (remaining > 0) {
    await sleep(remaining);
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  console.log(`\n[simulate] ${elapsed()} Demo window complete — stopping agents…`);

  for (const child of children) {
    child.kill("SIGTERM");
  }

  // Give processes a moment to exit
  await sleep(2000);

  console.log("\n[simulate] Demo simulation finished.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("[simulate] Fatal:", err);
  process.exit(1);
});
