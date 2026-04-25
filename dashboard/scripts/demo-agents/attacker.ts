// attacker.ts — Deliberately misbehaving agent for demo.
// Starts with 1-2 normal transactions, then bursts high-amount txns to trigger
// the AI judge's anomaly detection and the kill switch.
// Run: cd dashboard && npm run demo:attacker

import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  loadDemoKeys,
  keypairFromArray,
  getClient,
  guardedSolTransfer,
  shortKey,
  solAmount,
  sleep,
} from "../demo-helpers";

// Phase 1: Blend in — small amounts, normal pace
const NORMAL_AMOUNTS = [0.03, 0.04]; // SOL
const NORMAL_INTERVAL_MS = 10_000;

// Phase 2: Attack — high amounts approaching per-tx cap, rapid burst
const ATTACK_AMOUNTS = [1.8, 1.9, 1.95, 1.98, 2.0]; // SOL (cap is 2 SOL)
const BURST_INTERVAL_MS = 2_000; // 2 seconds between txns

async function main() {
  const keys = loadDemoKeys();
  const owner = keypairFromArray(keys.owner);
  const attacker = keypairFromArray(keys.attacker);

  const client = getClient(attacker);

  const [policyPda] = client.findPolicyPda(owner.publicKey, attacker.publicKey);
  const [trackerPda] = client.findTrackerPda(policyPda);

  // Drain destination — simulates the attacker's external wallet
  const drainWallet = Keypair.generate().publicKey;

  console.log(`\n[attacker] Starting attacker agent`);
  console.log(`  Agent:   ${shortKey(attacker.publicKey)}`);
  console.log(`  Policy:  ${shortKey(policyPda)}`);
  console.log(`  Drain:   ${shortKey(drainWallet)}`);
  console.log();

  let txnCount = 0;

  // -------------------------------------------------------------------------
  // Phase 1: Normal behavior (blend in)
  // -------------------------------------------------------------------------

  console.log("[attacker] Phase 1: Blending in with normal transactions…\n");

  for (const solAmt of NORMAL_AMOUNTS) {
    const lamports = Math.floor(solAmt * LAMPORTS_PER_SOL);

    try {
      const sig = await guardedSolTransfer(
        client,
        attacker,
        policyPda,
        trackerPda,
        drainWallet,
        lamports,
      );
      txnCount++;
      console.log(
        `[attacker] #${txnCount} ✓ ${solAmount(lamports)} (normal) | ${sig.slice(0, 16)}…`,
      );
    } catch (err: any) {
      console.error(`[attacker] ✗ Normal txn failed:`, err.message?.slice(0, 100) ?? err);
    }

    await sleep(NORMAL_INTERVAL_MS);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Attack — burst drain attempt
  // -------------------------------------------------------------------------

  console.log("\n[attacker] Phase 2: Starting burst drain attempt…\n");

  for (const solAmt of ATTACK_AMOUNTS) {
    const lamports = Math.floor(solAmt * LAMPORTS_PER_SOL);

    try {
      const sig = await guardedSolTransfer(
        client,
        attacker,
        policyPda,
        trackerPda,
        drainWallet,
        lamports,
      );
      txnCount++;
      const pctOfCap = ((solAmt / 2.0) * 100).toFixed(0);
      console.log(
        `[attacker] #${txnCount} ✓ ${solAmount(lamports)} (${pctOfCap}% of cap) | ${sig.slice(0, 16)}…`,
      );
    } catch (err: any) {
      txnCount++;
      const errMsg = err.message?.slice(0, 120) ?? String(err);

      if (errMsg.includes("PolicyPaused")) {
        console.log(`[attacker] #${txnCount} ✗ BLOCKED — agent has been paused by the kill switch!`);
        console.log("[attacker] The guardrails system detected the attack and stopped us.");
        break;
      } else if (errMsg.includes("DailyBudgetExceeded")) {
        console.log(`[attacker] #${txnCount} ✗ BLOCKED — daily budget exceeded.`);
        break;
      } else if (errMsg.includes("AmountExceedsLimit")) {
        console.log(`[attacker] #${txnCount} ✗ BLOCKED — per-tx amount limit exceeded.`);
        continue;
      } else {
        console.error(`[attacker] #${txnCount} ✗ Error:`, errMsg);
      }
    }

    await sleep(BURST_INTERVAL_MS);
  }

  console.log(`\n[attacker] Done. ${txnCount} transactions attempted.`);
}

main().catch((err) => {
  console.error("[attacker] Fatal:", err);
  process.exit(1);
});
