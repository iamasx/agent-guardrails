// setup-demo.ts — Creates demo keypairs, policies, and funds PDAs on devnet.
// Run: cd dashboard && npm run demo:setup
//
// Creates three agents (trader, staker, attacker) with policies under one owner.
// Saves all keypairs to .demo-keys.json for the agent scripts to load.

import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  saveDemoKeys,
  getConnection,
  getClient,
  shortKey,
  airdropSol,
  sleep,
} from "./demo-helpers";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

async function main() {
  console.log("\n=== Agent Guardrails — Demo Setup ===\n");

  const connection = getConnection();

  // -------------------------------------------------------------------------
  // Step 1: Generate keypairs
  // -------------------------------------------------------------------------

  const owner = Keypair.generate();
  const monitor = Keypair.generate();
  const trader = Keypair.generate();
  const staker = Keypair.generate();
  const attacker = Keypair.generate();

  console.log("[demo] Generated keypairs:");
  console.log(`  Owner:    ${shortKey(owner.publicKey)}`);
  console.log(`  Monitor:  ${shortKey(monitor.publicKey)}`);
  console.log(`  Trader:   ${shortKey(trader.publicKey)}`);
  console.log(`  Staker:   ${shortKey(staker.publicKey)}`);
  console.log(`  Attacker: ${shortKey(attacker.publicKey)}`);

  // -------------------------------------------------------------------------
  // Step 2: Airdrop SOL to owner and agent keypairs
  // -------------------------------------------------------------------------

  // Owner needs SOL for: rent (3 policies × 2 PDAs) + funding PDAs + tx fees
  await airdropSol(connection, owner.publicKey, 5);
  await sleep(1000);

  // Agents need SOL for tx fees (they sign the outer transaction)
  for (const [, kp] of [["trader", trader], ["staker", staker], ["attacker", attacker]] as const) {
    await airdropSol(connection, (kp as Keypair).publicKey, 1);
    await sleep(1000);
  }

  // Monitor needs SOL for pause_agent tx fees
  await airdropSol(connection, monitor.publicKey, 1);

  // -------------------------------------------------------------------------
  // Step 3: Create policies
  // -------------------------------------------------------------------------

  const client = getClient(owner);
  const now = Math.floor(Date.now() / 1000);
  const sessionExpiry = new BN(now + SEVEN_DAYS_SECONDS);

  // --- Trader policy: System Program, 2 SOL per-tx, 20 SOL daily ---
  console.log("\n[demo] Creating trader policy…");
  const traderTxSig = await client.initializePolicy(trader.publicKey, {
    allowedPrograms: [SystemProgram.programId],
    maxTxLamports: new BN(2 * LAMPORTS_PER_SOL),
    maxTxTokenUnits: new BN(0),
    dailyBudgetLamports: new BN(20 * LAMPORTS_PER_SOL),
    sessionExpiry,
    squadsMultisig: null,
    escalationThreshold: new BN(0),
    authorizedMonitors: [monitor.publicKey],
  });
  console.log(`  ✓ Trader policy created: ${traderTxSig.slice(0, 20)}…`);

  // --- Staker policy: System Program, 1 SOL per-tx, 10 SOL daily ---
  console.log("[demo] Creating staker policy…");
  const stakerTxSig = await client.initializePolicy(staker.publicKey, {
    allowedPrograms: [SystemProgram.programId],
    maxTxLamports: new BN(1 * LAMPORTS_PER_SOL),
    maxTxTokenUnits: new BN(0),
    dailyBudgetLamports: new BN(10 * LAMPORTS_PER_SOL),
    sessionExpiry,
    squadsMultisig: null,
    escalationThreshold: new BN(0),
    authorizedMonitors: [monitor.publicKey],
  });
  console.log(`  ✓ Staker policy created: ${stakerTxSig.slice(0, 20)}…`);

  // --- Attacker policy: System Program, 2 SOL per-tx, 20 SOL daily ---
  console.log("[demo] Creating attacker policy…");
  const attackerTxSig = await client.initializePolicy(attacker.publicKey, {
    allowedPrograms: [SystemProgram.programId],
    maxTxLamports: new BN(2 * LAMPORTS_PER_SOL),
    maxTxTokenUnits: new BN(0),
    dailyBudgetLamports: new BN(20 * LAMPORTS_PER_SOL),
    sessionExpiry,
    squadsMultisig: null,
    escalationThreshold: new BN(0),
    authorizedMonitors: [monitor.publicKey],
  });
  console.log(`  ✓ Attacker policy created: ${attackerTxSig.slice(0, 20)}…`);

  // -------------------------------------------------------------------------
  // Step 4: Fund policy PDAs with SOL
  // -------------------------------------------------------------------------

  console.log("\n[demo] Funding policy PDAs…");

  const fundingPlan: [string, Keypair, number][] = [
    ["trader", trader, 3],
    ["staker", staker, 2],
    ["attacker", attacker, 3],
  ];

  for (const [label, agentKp, amount] of fundingPlan) {
    const [policyPda] = client.findPolicyPda(owner.publicKey, agentKp.publicKey);

    const tx = new (await import("@solana/web3.js")).Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: policyPda,
        lamports: amount * LAMPORTS_PER_SOL,
      }),
    );

    await (client.program.provider as any).sendAndConfirm(tx);
    console.log(`  ✓ ${label} PDA funded with ${amount} SOL (${shortKey(policyPda)})`);
  }

  // -------------------------------------------------------------------------
  // Step 5: Save keypairs
  // -------------------------------------------------------------------------

  saveDemoKeys({
    owner: Array.from(owner.secretKey),
    monitor: Array.from(monitor.secretKey),
    trader: Array.from(trader.secretKey),
    staker: Array.from(staker.secretKey),
    attacker: Array.from(attacker.secretKey),
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  const [traderPda] = client.findPolicyPda(owner.publicKey, trader.publicKey);
  const [stakerPda] = client.findPolicyPda(owner.publicKey, staker.publicKey);
  const [attackerPda] = client.findPolicyPda(owner.publicKey, attacker.publicKey);

  console.log("\n=== Demo Setup Complete ===\n");
  console.log("Policies:");
  console.log(`  Trader:   ${traderPda.toBase58()}`);
  console.log(`  Staker:   ${stakerPda.toBase58()}`);
  console.log(`  Attacker: ${attackerPda.toBase58()}`);
  console.log(`\nOwner:   ${owner.publicKey.toBase58()}`);
  console.log(`Monitor: ${monitor.publicKey.toBase58()}`);
  console.log("\nNext steps:");
  console.log("  1. Configure Helius webhook → server /webhook endpoint");
  console.log("  2. Start server: cd server && pnpm dev");
  console.log("  3. Start dashboard: cd dashboard && npm run dev");
  console.log("  4. Run demo: npm run demo:simulate");
}

main().catch((err) => {
  console.error("[demo] Setup failed:", err);
  process.exit(1);
});
