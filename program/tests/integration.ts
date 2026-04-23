// Tests for cross-instruction lifecycle flows (init -> pause -> resume -> execute, budget rollover).

// Standard deps imported directly from packages
import anchor from "@coral-xyz/anchor";
const { BN } = anchor;
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

  it("update whitelist adds program → execute with new program passes validation", async () => {
    const owner = Keypair.generate();
    const agent = Keypair.generate();
    const newProgram = Keypair.generate(); // random "program" to whitelist
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    svm.airdrop(agent.publicKey, 2_000_000_000n);

    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

    // Init with only System Program allowed
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
        owner: owner.publicKey, agent: agent.publicKey,
        policy: policyPda, spendTracker: trackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    // Execute targeting newProgram → should fail (not whitelisted)
    try {
      await program.methods
        .guardedExecute({ instructionData: Buffer.alloc(4), amountHint: new BN(0) })
        .accounts({
          agent: agent.publicKey, policy: policyPda, spendTracker: trackerPda,
          targetProgram: newProgram.publicKey, systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: newProgram.publicKey, isWritable: false, isSigner: false },
        ])
        .signers([agent])
        .rpc();
      expect.fail("Expected ProgramNotWhitelisted");
    } catch (err: any) {
      expect(err.toString()).to.include("ProgramNotWhitelisted");
    }

    // Update whitelist to include newProgram
    await program.methods
      .updatePolicy({
        allowedPrograms: [SystemProgram.programId, newProgram.publicKey],
        maxTxLamports: null, maxTxTokenUnits: null, dailyBudgetLamports: null,
        sessionExpiry: null, squadsMultisig: null, escalationThreshold: null,
        authorizedMonitors: null, anomalyScore: null,
      })
      .accounts({ owner: owner.publicKey, policy: policyPda })
      .signers([owner])
      .rpc();

    // Execute targeting newProgram → should pass validation now
    // (will fail at CPI since newProgram isn't a real program, but NOT ProgramNotWhitelisted)
    try {
      await program.methods
        .guardedExecute({ instructionData: Buffer.alloc(4), amountHint: new BN(0) })
        .accounts({
          agent: agent.publicKey, policy: policyPda, spendTracker: trackerPda,
          targetProgram: newProgram.publicKey, systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: newProgram.publicKey, isWritable: false, isSigner: false },
        ])
        .signers([agent])
        .rpc();
    } catch (err: any) {
      expect(err.toString()).to.not.include("ProgramNotWhitelisted");
    }
  });

  it("update removes program from whitelist → execute fails with ProgramNotWhitelisted", async () => {
    const owner = Keypair.generate();
    const agent = Keypair.generate();
    const extraProgram = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    svm.airdrop(agent.publicKey, 2_000_000_000n);

    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

    // Init with System Program + extraProgram allowed
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId, extraProgram.publicKey],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(10_000_000_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: owner.publicKey, agent: agent.publicKey,
        policy: policyPda, spendTracker: trackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    // Update: remove extraProgram from whitelist (only keep System Program)
    await program.methods
      .updatePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: null, maxTxTokenUnits: null, dailyBudgetLamports: null,
        sessionExpiry: null, squadsMultisig: null, escalationThreshold: null,
        authorizedMonitors: null, anomalyScore: null,
      })
      .accounts({ owner: owner.publicKey, policy: policyPda })
      .signers([owner])
      .rpc();

    // Execute targeting extraProgram → should fail (no longer whitelisted)
    try {
      await program.methods
        .guardedExecute({ instructionData: Buffer.alloc(4), amountHint: new BN(0) })
        .accounts({
          agent: agent.publicKey, policy: policyPda, spendTracker: trackerPda,
          targetProgram: extraProgram.publicKey, systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: extraProgram.publicKey, isWritable: false, isSigner: false },
        ])
        .signers([agent])
        .rpc();
      expect.fail("Expected ProgramNotWhitelisted");
    } catch (err: any) {
      expect(err.toString()).to.include("ProgramNotWhitelisted");
    }
  });

  it("add squads via update → large transfer triggers EscalatedToMultisig", async () => {
    const owner = Keypair.generate();
    const agent = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    svm.airdrop(agent.publicKey, 2_000_000_000n);

    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

    // Init WITHOUT squads multisig
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(2_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(500_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: owner.publicKey, agent: agent.publicKey,
        policy: policyPda, spendTracker: trackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    // 1 SOL transfer should NOT escalate (no multisig set)
    const txData = buildSystemTransferData(1_000_000_000n);
    try {
      await program.methods
        .guardedExecute({ instructionData: txData, amountHint: new BN(1_000_000_000) })
        .accounts({
          agent: agent.publicKey, policy: policyPda, spendTracker: trackerPda,
          targetProgram: SystemProgram.programId, systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: policyPda, isWritable: true, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([agent])
        .rpc();
    } catch (err: any) {
      // Should NOT be EscalatedToMultisig (no multisig set)
      expect(err.toString()).to.not.include("EscalatedToMultisig");
    }

    // Update: add squads multisig
    const squadsMultisig = Keypair.generate().publicKey;
    await program.methods
      .updatePolicy({
        allowedPrograms: null, maxTxLamports: null, maxTxTokenUnits: null,
        dailyBudgetLamports: null, sessionExpiry: null,
        squadsMultisig: squadsMultisig,
        escalationThreshold: new BN(500_000), // 500k threshold
        authorizedMonitors: null, anomalyScore: null,
      })
      .accounts({ owner: owner.publicKey, policy: policyPda })
      .signers([owner])
      .rpc();

    // Same 1 SOL transfer now exceeds 500k threshold → should escalate
    const txData2 = buildSystemTransferData(1_000_000_001n); // unique amount
    try {
      await program.methods
        .guardedExecute({ instructionData: txData2, amountHint: new BN(1_000_000_001) })
        .accounts({
          agent: agent.publicKey, policy: policyPda, spendTracker: trackerPda,
          targetProgram: SystemProgram.programId, systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: policyPda, isWritable: true, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([agent])
        .rpc();
      expect.fail("Expected EscalatedToMultisig");
    } catch (err: any) {
      expect(err.toString()).to.include("EscalatedToMultisig");
    }
  });

  it("extend session via update → execute succeeds after original expiry", async () => {
    const owner = Keypair.generate();
    const agent = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    svm.airdrop(agent.publicKey, 2_000_000_000n);

    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

    const currentClock = svm.getClock();
    const originalExpiry = new BN(Number(currentClock.unixTimestamp) + 100);
    const extendedExpiry = new BN(Number(currentClock.unixTimestamp) + 10_000);

    // Init with short session expiry (now + 100s)
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: originalExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(10_000_000_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: owner.publicKey, agent: agent.publicKey,
        policy: policyPda, spendTracker: trackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    // Extend session to now + 10000s
    await program.methods
      .updatePolicy({
        allowedPrograms: null, maxTxLamports: null, maxTxTokenUnits: null,
        dailyBudgetLamports: null,
        sessionExpiry: extendedExpiry,
        squadsMultisig: null, escalationThreshold: null,
        authorizedMonitors: null, anomalyScore: null,
      })
      .accounts({ owner: owner.publicKey, policy: policyPda })
      .signers([owner])
      .rpc();

    // Warp clock past original expiry but before extended expiry
    try {
      svm.setClock(new Clock(
        currentClock.slot + 500n,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(originalExpiry.toNumber() + 50), // past original, before extended
      ));

      const txData = buildSystemTransferData(100_000n);
      try {
        await program.methods
          .guardedExecute({ instructionData: txData, amountHint: new BN(100_000) })
          .accounts({
            agent: agent.publicKey, policy: policyPda, spendTracker: trackerPda,
            targetProgram: SystemProgram.programId, systemProgram: SystemProgram.programId,
          })
          .remainingAccounts([
            { pubkey: policyPda, isWritable: true, isSigner: false },
            { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
            { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
          ])
          .signers([agent])
          .rpc();
      } catch (err: any) {
        // Should NOT be SessionExpired — session was extended
        expect(err.toString()).to.not.include("SessionExpired");
      }
    } finally {
      svm.setClock(currentClock);
    }
  });

  it("two agents for same owner — pausing one does not affect the other", async () => {
    const owner = Keypair.generate();
    const agent1 = Keypair.generate();
    const agent2 = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    svm.airdrop(agent1.publicKey, 2_000_000_000n);
    svm.airdrop(agent2.publicKey, 2_000_000_000n);

    const [policy1Pda] = findPolicyPda(owner.publicKey, agent1.publicKey);
    const [tracker1Pda] = findTrackerPda(policy1Pda);
    const [policy2Pda] = findPolicyPda(owner.publicKey, agent2.publicKey);
    const [tracker2Pda] = findTrackerPda(policy2Pda);

    // Init both policies
    for (const [agentKp, policyPda, trackerPda] of [
      [agent1, policy1Pda, tracker1Pda],
      [agent2, policy2Pda, tracker2Pda],
    ] as [Keypair, PublicKey, PublicKey][]) {
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
          owner: owner.publicKey, agent: agentKp.publicKey,
          policy: policyPda, spendTracker: trackerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
    }

    // Pause agent1
    await program.methods
      .pauseAgent({ reason: Buffer.from("Agent 1 compromised") })
      .accounts({ caller: owner.publicKey, policy: policy1Pda })
      .signers([owner])
      .rpc();

    // Agent1 should be paused
    const p1 = await program.account.permissionPolicy.fetch(policy1Pda);
    expect(p1.isActive).to.be.false;

    // Agent2 should still be active
    const p2 = await program.account.permissionPolicy.fetch(policy2Pda);
    expect(p2.isActive).to.be.true;

    // Agent2 can still pass validation (will fail at CPI, but not PolicyPaused)
    const txData = buildSystemTransferData(100_000n);
    try {
      await program.methods
        .guardedExecute({ instructionData: txData, amountHint: new BN(100_000) })
        .accounts({
          agent: agent2.publicKey, policy: policy2Pda, spendTracker: tracker2Pda,
          targetProgram: SystemProgram.programId, systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: policy2Pda, isWritable: true, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([agent2])
        .rpc();
    } catch (err: any) {
      expect(err.toString()).to.not.include("PolicyPaused");
    }
  });

  it("update policy while paused → resume → new limits enforced", async () => {
    const owner = Keypair.generate();
    const agent = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    svm.airdrop(agent.publicKey, 2_000_000_000n);

    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

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
        owner: owner.publicKey, agent: agent.publicKey,
        policy: policyPda, spendTracker: trackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    // Pause the agent
    await program.methods
      .pauseAgent({ reason: Buffer.from("Reviewing limits") })
      .accounts({ caller: owner.publicKey, policy: policyPda })
      .signers([owner])
      .rpc();

    // Update limits WHILE paused — lower per-tx to 50k
    await program.methods
      .updatePolicy({
        allowedPrograms: null,
        maxTxLamports: new BN(50_000),
        maxTxTokenUnits: null, dailyBudgetLamports: null,
        sessionExpiry: null, squadsMultisig: null, escalationThreshold: null,
        authorizedMonitors: null, anomalyScore: null,
      })
      .accounts({ owner: owner.publicKey, policy: policyPda })
      .signers([owner])
      .rpc();

    // Resume
    await program.methods
      .resumeAgent()
      .accounts({ owner: owner.publicKey, policy: policyPda })
      .signers([owner])
      .rpc();

    // Try 100k transfer → should fail with AmountExceedsLimit (new 50k limit)
    const txData = buildSystemTransferData(100_000n);
    try {
      await program.methods
        .guardedExecute({ instructionData: txData, amountHint: new BN(100_000) })
        .accounts({
          agent: agent.publicKey, policy: policyPda, spendTracker: trackerPda,
          targetProgram: SystemProgram.programId, systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: policyPda, isWritable: true, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([agent])
        .rpc();
      expect.fail("Expected AmountExceedsLimit");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsLimit");
    }
  });
});
