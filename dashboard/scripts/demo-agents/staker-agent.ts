// staker-agent.ts — Honest agent doing SOL transfers simulating staking/unstaking.
// Operates within policy limits at a slower, steadier pace than the trader.
// Run: cd dashboard && npm run demo:staker

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

// Staking behavior: moderate amounts, slow pace
const MIN_AMOUNT_LAMPORTS = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL
const MAX_AMOUNT_LAMPORTS = 0.2 * LAMPORTS_PER_SOL;  // 0.2 SOL
const MIN_INTERVAL_MS = 30_000;  // 30 seconds
const MAX_INTERVAL_MS = 60_000;  // 60 seconds

async function main() {
  const keys = loadDemoKeys();
  const owner = keypairFromArray(keys.owner);
  const staker = keypairFromArray(keys.staker);

  const client = getClient(staker);

  const [policyPda] = client.findPolicyPda(owner.publicKey, staker.publicKey);
  const [trackerPda] = client.findTrackerPda(policyPda);

  // Simulates a Marinade/staking pool address
  const stakingPool = Keypair.generate().publicKey;

  console.log(`\n[staker] Starting staker agent`);
  console.log(`  Agent:   ${shortKey(staker.publicKey)}`);
  console.log(`  Policy:  ${shortKey(policyPda)}`);
  console.log(`  Pool:    ${shortKey(stakingPool)}`);
  console.log(`  Range:   ${solAmount(MIN_AMOUNT_LAMPORTS)} – ${solAmount(MAX_AMOUNT_LAMPORTS)}`);
  console.log(`  Pace:    ${MIN_INTERVAL_MS / 1000}–${MAX_INTERVAL_MS / 1000}s\n`);

  let txnCount = 0;

  while (true) {
    const amount = randomBetween(MIN_AMOUNT_LAMPORTS, MAX_AMOUNT_LAMPORTS);

    try {
      const sig = await guardedSolTransfer(
        client,
        staker,
        policyPda,
        trackerPda,
        stakingPool,
        amount,
      );
      txnCount++;
      console.log(
        `[staker] #${txnCount} ✓ ${solAmount(amount)} → pool ${shortKey(stakingPool)} | ${sig.slice(0, 16)}…`,
      );
    } catch (err: any) {
      console.error(`[staker] ✗ Failed:`, err.message?.slice(0, 100) ?? err);
      if (
        err.message?.includes("PolicyPaused") ||
        err.message?.includes("DailyBudgetExceeded")
      ) {
        console.log("[staker] Policy constraint hit — stopping.");
        break;
      }
    }

    const interval = randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
    await sleep(interval);
  }
}

main().catch((err) => {
  console.error("[staker] Fatal:", err);
  process.exit(1);
});
