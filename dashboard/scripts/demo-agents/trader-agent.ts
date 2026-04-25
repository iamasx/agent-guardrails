// trader-agent.ts — Honest agent running System Program SOL transfers within limits.
// Simulates a DeFi trading bot operating normally within its policy guardrails.
// Run: cd dashboard && npm run demo:trader

import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  loadDemoKeys,
  keypairFromArray,
  getClient,
  guardedSolTransfer,
  shortKey,
  solAmount,
  sleep,
  randomBetween,
} from "../demo-helpers";

// Normal trading behavior: small amounts, steady pace
const MIN_AMOUNT_LAMPORTS = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL
const MAX_AMOUNT_LAMPORTS = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL
const MIN_INTERVAL_MS = 15_000;  // 15 seconds
const MAX_INTERVAL_MS = 30_000;  // 30 seconds

async function main() {
  const keys = loadDemoKeys();
  const owner = keypairFromArray(keys.owner);
  const trader = keypairFromArray(keys.trader);

  // Use the agent keypair as the provider wallet (agent pays fees)
  const client = getClient(trader);

  const [policyPda] = client.findPolicyPda(owner.publicKey, trader.publicKey);
  const [trackerPda] = client.findTrackerPda(policyPda);

  // Generate a random destination (simulates swap output address)
  const destination = Keypair.generate().publicKey;

  console.log(`\n[trader] Starting trader agent`);
  console.log(`  Agent:   ${shortKey(trader.publicKey)}`);
  console.log(`  Policy:  ${shortKey(policyPda)}`);
  console.log(`  Dest:    ${shortKey(destination)}`);
  console.log(`  Range:   ${solAmount(MIN_AMOUNT_LAMPORTS)} – ${solAmount(MAX_AMOUNT_LAMPORTS)}`);
  console.log(`  Pace:    ${MIN_INTERVAL_MS / 1000}–${MAX_INTERVAL_MS / 1000}s\n`);

  let txnCount = 0;

  while (true) {
    const amount = randomBetween(MIN_AMOUNT_LAMPORTS, MAX_AMOUNT_LAMPORTS);

    try {
      const sig = await guardedSolTransfer(
        client,
        trader,
        policyPda,
        trackerPda,
        destination,
        amount,
      );
      txnCount++;
      console.log(
        `[trader] #${txnCount} ✓ ${solAmount(amount)} → ${shortKey(destination)} | ${sig.slice(0, 16)}…`,
      );
    } catch (err: any) {
      console.error(`[trader] ✗ Failed:`, err.message?.slice(0, 100) ?? err);
      // If the policy is paused or budget exceeded, stop
      if (
        err.message?.includes("PolicyPaused") ||
        err.message?.includes("DailyBudgetExceeded")
      ) {
        console.log("[trader] Policy constraint hit — stopping.");
        break;
      }
    }

    const interval = randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
    await sleep(interval);
  }
}

main().catch((err) => {
  console.error("[trader] Fatal:", err);
  process.exit(1);
});
