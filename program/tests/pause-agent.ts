// Tests for the pause_agent instruction (owner/monitor authorization, kill switch enforcement).

// Standard deps imported directly from packages
import anchor from "@coral-xyz/anchor";
const { BN } = anchor;
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

// Setup + helpers from helpers.ts
import { svm, program, findPolicyPda, findTrackerPda, defaultSessionExpiry } from "./helpers.js";

describe("pause_agent", () => {
  const pauseOwner = Keypair.generate();
  const pauseAgent = Keypair.generate();
  const monitor = Keypair.generate();
  let pausePolicyPda: PublicKey;
  let pauseTrackerPda: PublicKey;

  before(async () => {
    svm.airdrop(pauseOwner.publicKey, 10_000_000_000n);
    svm.airdrop(monitor.publicKey, 1_000_000_000n);
    svm.airdrop(pauseAgent.publicKey, 2_000_000_000n);

    [pausePolicyPda] = findPolicyPda(pauseOwner.publicKey, pauseAgent.publicKey);
    [pauseTrackerPda] = findTrackerPda(pausePolicyPda);

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
        authorizedMonitors: [monitor.publicKey],
      })
      .accounts({
        owner: pauseOwner.publicKey,
        agent: pauseAgent.publicKey,
        policy: pausePolicyPda,
        spendTracker: pauseTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([pauseOwner])
      .rpc();
  });

  it("owner can pause agent with reason", async () => {
    const reason = Buffer.from("Suspicious activity detected");

    await program.methods
      .pauseAgent({ reason: reason })
      .accounts({
        caller: pauseOwner.publicKey,
        policy: pausePolicyPda,
      })
      .signers([pauseOwner])
      .rpc();

    const policy = await program.account.permissionPolicy.fetch(pausePolicyPda);
    expect(policy.isActive).to.be.false;
    expect(policy.pausedBy.toBase58()).to.equal(pauseOwner.publicKey.toBase58());

    // Verify reason bytes match
    const storedReason = Buffer.from(policy.pausedReason);
    expect(storedReason.subarray(0, reason.length).toString()).to.equal(
      reason.toString()
    );
  });

  it("owner resumes so monitor can pause next", async () => {
    await program.methods
      .resumeAgent()
      .accounts({
        owner: pauseOwner.publicKey,
        policy: pausePolicyPda,
      })
      .signers([pauseOwner])
      .rpc();

    const policy = await program.account.permissionPolicy.fetch(pausePolicyPda);
    expect(policy.isActive).to.be.true;
  });

  it("authorized monitor can pause agent", async () => {
    await program.methods
      .pauseAgent({ reason: Buffer.from("Anomaly score exceeded") })
      .accounts({
        caller: monitor.publicKey,
        policy: pausePolicyPda,
      })
      .signers([monitor])
      .rpc();

    const policy = await program.account.permissionPolicy.fetch(pausePolicyPda);
    expect(policy.isActive).to.be.false;
    expect(policy.pausedBy.toBase58()).to.equal(monitor.publicKey.toBase58());
  });

  it("unauthorized caller cannot pause agent", async () => {
    // Use a fresh policy to avoid state dependencies on previous tests
    const freshOwner = Keypair.generate();
    const freshAgent = Keypair.generate();
    svm.airdrop(freshOwner.publicKey, 10_000_000_000n);

    const [freshPolicyPda] = findPolicyPda(freshOwner.publicKey, freshAgent.publicKey);
    const [freshTrackerPda] = findTrackerPda(freshPolicyPda);

    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(2_000_000_000),
        authorizedMonitors: [], // No monitors — only owner can pause
      })
      .accounts({
        owner: freshOwner.publicKey,
        agent: freshAgent.publicKey,
        policy: freshPolicyPda,
        spendTracker: freshTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([freshOwner])
      .rpc();

    const attacker = Keypair.generate();
    svm.airdrop(attacker.publicKey, 1_000_000_000n);

    try {
      await program.methods
        .pauseAgent({ reason: Buffer.from("hacked") })
        .accounts({ caller: attacker.publicKey, policy: freshPolicyPda })
        .signers([attacker])
        .rpc();

      expect.fail("Expected UnauthorizedPauser error");
    } catch (err: any) {
      // Attacker is neither owner nor monitor — transaction must fail
      expect(err).to.exist;
    }
  });

  it("re-pausing an already paused agent succeeds with new reason", async () => {
    // The policy was paused by the monitor in the previous test.
    // Pause again with a different reason — should succeed (no error),
    // and the new reason should overwrite the old one.
    const newReason = Buffer.from("Second pause: re-evaluation");

    await program.methods
      .pauseAgent({ reason: newReason })
      .accounts({
        caller: pauseOwner.publicKey,
        policy: pausePolicyPda,
      })
      .signers([pauseOwner])
      .rpc();

    const policy = await program.account.permissionPolicy.fetch(pausePolicyPda);
    expect(policy.isActive).to.be.false;
    expect(policy.pausedBy.toBase58()).to.equal(pauseOwner.publicKey.toBase58());

    // Verify the new reason was stored (not the old one)
    const storedReason = Buffer.from(policy.pausedReason);
    expect(storedReason.subarray(0, newReason.length).toString()).to.equal(
      newReason.toString()
    );
  });

  it("truncates reason at 64 bytes without error", async () => {
    // Use a fresh policy to avoid state dependencies
    const truncOwner = Keypair.generate();
    const truncAgent = Keypair.generate();
    svm.airdrop(truncOwner.publicKey, 10_000_000_000n);

    const [truncPolicyPda] = findPolicyPda(truncOwner.publicKey, truncAgent.publicKey);
    const [truncTrackerPda] = findTrackerPda(truncPolicyPda);

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
        owner: truncOwner.publicKey,
        agent: truncAgent.publicKey,
        policy: truncPolicyPda,
        spendTracker: truncTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([truncOwner])
      .rpc();

    // 80-byte reason — exceeds the 64-byte field
    const longReason = Buffer.alloc(80, 0x41); // 80 bytes of 'A'

    await program.methods
      .pauseAgent({ reason: longReason })
      .accounts({
        caller: truncOwner.publicKey,
        policy: truncPolicyPda,
      })
      .signers([truncOwner])
      .rpc();

    const policy = await program.account.permissionPolicy.fetch(truncPolicyPda);
    expect(policy.isActive).to.be.false;

    // Verify only first 64 bytes were stored
    const storedReason = Buffer.from(policy.pausedReason);
    expect(storedReason.length).to.equal(64);
    // All 64 bytes should be 0x41 ('A')
    expect(storedReason.every((b: number) => b === 0x41)).to.be.true;
  });

  it("paused policy rejects guarded_execute with PolicyPaused", async () => {
    // Pause the policy
    await program.methods
      .pauseAgent({ reason: Buffer.from("Kill switch test") })
      .accounts({ caller: pauseOwner.publicKey, policy: pausePolicyPda })
      .signers([pauseOwner])
      .rpc();

    // Try guarded_execute — should fail with PolicyPaused
    const dest = Keypair.generate();
    const txData = Buffer.alloc(12);
    txData.writeUInt32LE(2, 0);
    txData.writeBigUInt64LE(100_000n, 4);

    try {
      await program.methods
        .guardedExecute({
          instructionData: txData,
          amountHint: new BN(100_000),
        })
        .accounts({
          agent: pauseAgent.publicKey,
          policy: pausePolicyPda,
          spendTracker: pauseTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: pausePolicyPda, isWritable: true, isSigner: false },
          { pubkey: dest.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([pauseAgent])
        .rpc();

      expect.fail("Expected PolicyPaused error");
    } catch (err: any) {
      expect(err.toString()).to.include("PolicyPaused");
    }
  });
});
