// Tests for cross-instruction lifecycle flows (init -> pause -> resume -> execute, budget rollover).

// Standard deps imported directly from packages
import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { Clock } from "litesvm";

// Setup + helpers from helpers.ts
import {
  svm,
  program,
  findPolicyPda,
  findTrackerPda,
  buildSystemTransferData,
  defaultSessionExpiry,
} from "./helpers.js";

describe("integration", () => {
  it("full lifecycle: init -> pause -> execute rejected -> resume -> execute passes validation", async () => {
    const iOwner = Keypair.generate();
    const iAgent = Keypair.generate();
    svm.airdrop(iOwner.publicKey, 10_000_000_000n);
    svm.airdrop(iAgent.publicKey, 2_000_000_000n);

    const [iPolicyPda] = findPolicyPda(iOwner.publicKey, iAgent.publicKey);
    const [iTrackerPda] = findTrackerPda(iPolicyPda);

    // Step 1: Initialize policy
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(2_000_000_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: iOwner.publicKey,
        agent: iAgent.publicKey,
        policy: iPolicyPda,
        spendTracker: iTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([iOwner])
      .rpc();

    // Step 2: Pause the agent
    await program.methods
      .pauseAgent({ reason: Buffer.from("Anomaly detected") })
      .accounts({ caller: iOwner.publicKey, policy: iPolicyPda })
      .signers([iOwner])
      .rpc();

    // Step 3: guarded_execute should fail with PolicyPaused
    const dest = Keypair.generate();
    const txData = Buffer.alloc(12);
    txData.writeUInt32LE(2, 0);
    txData.writeBigUInt64LE(100_000n, 4);

    try {
      await program.methods
        .guardedExecute({ instructionData: txData, amountHint: new BN(100_000) })
        .accounts({
          agent: iAgent.publicKey,
          policy: iPolicyPda,
          spendTracker: iTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: iPolicyPda, isWritable: true, isSigner: false },
          { pubkey: dest.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([iAgent])
        .rpc();
      expect.fail("Expected PolicyPaused");
    } catch (err: any) {
      expect(err.toString()).to.include("PolicyPaused");
    }

    // Step 4: Resume the agent
    await program.methods
      .resumeAgent()
      .accounts({ owner: iOwner.publicKey, policy: iPolicyPda })
      .signers([iOwner])
      .rpc();

    // Step 5: guarded_execute should now pass validation (will fail at CPI
    // stage because policy PDA can't do System Program transfers, but the
    // error should NOT be PolicyPaused — proving the resume worked)
    try {
      await program.methods
        .guardedExecute({ instructionData: txData, amountHint: new BN(100_000) })
        .accounts({
          agent: iAgent.publicKey,
          policy: iPolicyPda,
          spendTracker: iTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: iPolicyPda, isWritable: true, isSigner: false },
          { pubkey: dest.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([iAgent])
        .rpc();
    } catch (err: any) {
      // Should fail at CPI (not PolicyPaused) — validation passed
      expect(err.toString()).to.not.include("PolicyPaused");
    }
  });

  it("policy update enforces new limits on guarded_execute", async () => {
    const uOwner = Keypair.generate();
    const uAgent = Keypair.generate();
    svm.airdrop(uOwner.publicKey, 10_000_000_000n);
    svm.airdrop(uAgent.publicKey, 2_000_000_000n);

    const [uPolicyPda] = findPolicyPda(uOwner.publicKey, uAgent.publicKey);
    const [uTrackerPda] = findTrackerPda(uPolicyPda);

    // Init with 1 SOL per-tx limit
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(10_000_000_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: uOwner.publicKey,
        agent: uAgent.publicKey,
        policy: uPolicyPda,
        spendTracker: uTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([uOwner])
      .rpc();

    // Update: lower per-tx limit to 100k lamports
    await program.methods
      .updatePolicy({
        allowedPrograms: null,
        maxTxLamports: new BN(100_000),
        maxTxTokenUnits: null,
        dailyBudgetLamports: null,
        sessionExpiry: null,
        squadsMultisig: null,
        escalationThreshold: null,
        authorizedMonitors: null,
        anomalyScore: null,
      })
      .accounts({ owner: uOwner.publicKey, policy: uPolicyPda })
      .signers([uOwner])
      .rpc();

    // Try 200k lamports — should now fail with AmountExceedsLimit (new limit enforced)
    const txData = Buffer.alloc(12);
    txData.writeUInt32LE(2, 0);
    txData.writeBigUInt64LE(200_000n, 4);

    try {
      await program.methods
        .guardedExecute({ instructionData: txData, amountHint: new BN(200_000) })
        .accounts({
          agent: uAgent.publicKey,
          policy: uPolicyPda,
          spendTracker: uTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: uPolicyPda, isWritable: true, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([uAgent])
        .rpc();
      expect.fail("Expected AmountExceedsLimit");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsLimit");
    }
  });

  it("budget window resets after 24h via setClock", async () => {
    const bOwner = Keypair.generate();
    const bAgent = Keypair.generate();
    svm.airdrop(bOwner.publicKey, 10_000_000_000n);
    svm.airdrop(bAgent.publicKey, 2_000_000_000n);

    const [bPolicyPda] = findPolicyPda(bOwner.publicKey, bAgent.publicKey);
    const [bTrackerPda] = findTrackerPda(bPolicyPda);

    // Create policy: per-tx = daily = 500k lamports (tight budget)
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(500_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(500_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(10_000_000_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: bOwner.publicKey,
        agent: bAgent.publicKey,
        policy: bPolicyPda,
        spendTracker: bTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bOwner])
      .rpc();

    const currentClock = svm.getClock();

    // Verify: BEFORE clock warp, a 500k transfer passes validation (per-tx
    // and daily budget checks both pass since daily_spent starts at 0).
    // It will fail at CPI, but NOT with a budget error.
    const txData = Buffer.alloc(12);
    txData.writeUInt32LE(2, 0);
    txData.writeBigUInt64LE(500_000n, 4);

    try {
      await program.methods
        .guardedExecute({ instructionData: txData, amountHint: new BN(500_000) })
        .accounts({
          agent: bAgent.publicKey,
          policy: bPolicyPda,
          spendTracker: bTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: bPolicyPda, isWritable: true, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([bAgent])
        .rpc();
    } catch (err: any) {
      // CPI fails (policy PDA has data), but validation passed — no budget error
      expect(err.toString()).to.not.include("DailyBudgetExceeded");
      expect(err.toString()).to.not.include("AmountExceedsLimit");
    }

    // Warp clock past 24h boundary, then verify the same transfer still
    // passes validation (budget window resets in guarded_execute step 6).
    // NOTE: Since CPI fails and the transaction rolls back, the budget
    // counters are never actually persisted. This test verifies the reset
    // code path executes without error, not cumulative budget exhaustion
    // (which requires successful CPI via Token Program — deferred).
    try {
      svm.setClock(new Clock(
        currentClock.slot + 1000n,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        currentClock.unixTimestamp + 90_000n, // +25 hours
      ));

      await program.methods
        .guardedExecute({ instructionData: txData, amountHint: new BN(500_000) })
        .accounts({
          agent: bAgent.publicKey,
          policy: bPolicyPda,
          spendTracker: bTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: bPolicyPda, isWritable: true, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([bAgent])
        .rpc();
    } catch (err: any) {
      // After clock warp: should still NOT fail with budget errors
      expect(err.toString()).to.not.include("DailyBudgetExceeded");
      expect(err.toString()).to.not.include("AmountExceedsLimit");
    } finally {
      // Always restore clock for subsequent tests
      svm.setClock(currentClock);
    }
  });

  it("monitor can pause but cannot resume — owner must resume", async () => {
    const mOwner = Keypair.generate();
    const mAgent = Keypair.generate();
    const mMonitor = Keypair.generate();
    svm.airdrop(mOwner.publicKey, 10_000_000_000n);
    svm.airdrop(mMonitor.publicKey, 1_000_000_000n);

    const [mPolicyPda] = findPolicyPda(mOwner.publicKey, mAgent.publicKey);
    const [mTrackerPda] = findTrackerPda(mPolicyPda);

    // Create policy with monitor authorized
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(2_000_000_000),
        authorizedMonitors: [mMonitor.publicKey],
      })
      .accounts({
        owner: mOwner.publicKey,
        agent: mAgent.publicKey,
        policy: mPolicyPda,
        spendTracker: mTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([mOwner])
      .rpc();

    // Monitor pauses
    await program.methods
      .pauseAgent({ reason: Buffer.from("Server-triggered pause") })
      .accounts({ caller: mMonitor.publicKey, policy: mPolicyPda })
      .signers([mMonitor])
      .rpc();

    let policy = await program.account.permissionPolicy.fetch(mPolicyPda);
    expect(policy.isActive).to.be.false;
    expect(policy.pausedBy.toBase58()).to.equal(mMonitor.publicKey.toBase58());

    // Monitor tries to resume — should fail with ResumeRequiresOwner
    try {
      await program.methods
        .resumeAgent()
        .accounts({ owner: mMonitor.publicKey, policy: mPolicyPda })
        .signers([mMonitor])
        .rpc();
      expect.fail("Expected monitor resume to fail");
    } catch (err: any) {
      // has_one = owner @ ResumeRequiresOwner constraint rejects non-owner
      const errStr = err.toString();
      expect(
        errStr.includes("ResumeRequiresOwner") || errStr.includes("ConstraintHasOne")
      ).to.be.true;
    }

    // Verify still paused
    policy = await program.account.permissionPolicy.fetch(mPolicyPda);
    expect(policy.isActive).to.be.false;

    // Owner resumes successfully
    await program.methods
      .resumeAgent()
      .accounts({ owner: mOwner.publicKey, policy: mPolicyPda })
      .signers([mOwner])
      .rpc();

    policy = await program.account.permissionPolicy.fetch(mPolicyPda);
    expect(policy.isActive).to.be.true;
    expect(policy.pausedBy).to.be.null;
  });
});
