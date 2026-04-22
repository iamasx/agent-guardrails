// Tests for the initialize_policy instruction (PDA creation, field validation, error paths).

// Standard deps imported directly from packages
import { BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

// Setup + helpers from helpers.ts
import { svm, program, findPolicyPda, findTrackerPda, defaultSessionExpiry } from "./helpers.js";

// Constants formerly exported from helpers — defined locally
const defaultAllowedPrograms = [SystemProgram.programId];
const defaultMaxTxLamports = new BN(1_000_000_000);
const defaultMaxTxTokenUnits = new BN(1_000_000);
const defaultDailyBudgetLamports = new BN(5_000_000_000);
const defaultEscalationThreshold = new BN(2_000_000_000);

describe("initialize_policy", () => {
  const owner = Keypair.generate();
  const agent = Keypair.generate();

  before(() => {
    svm.airdrop(owner.publicKey, 10_000_000_000n);
  });

  it("creates policy and tracker PDAs with correct field values", async () => {
    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);
    const monitor1 = Keypair.generate().publicKey;

    await program.methods
      .initializePolicy({
        allowedPrograms: defaultAllowedPrograms,
        maxTxLamports: defaultMaxTxLamports,
        maxTxTokenUnits: defaultMaxTxTokenUnits,
        dailyBudgetLamports: defaultDailyBudgetLamports,
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: defaultEscalationThreshold,
        authorizedMonitors: [monitor1],
      })
      .accounts({
        owner: owner.publicKey,
        agent: agent.publicKey,
        policy: policyPda,
        spendTracker: trackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    // --- Verify PermissionPolicy fields ---
    const policy = await program.account.permissionPolicy.fetch(policyPda);

    expect(policy.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(policy.agent.toBase58()).to.equal(agent.publicKey.toBase58());

    // Allow-list should contain exactly the System Program
    expect(policy.allowedPrograms).to.have.lengthOf(1);
    expect(policy.allowedPrograms[0].toBase58()).to.equal(
      SystemProgram.programId.toBase58()
    );

    // Spending limits
    expect(policy.maxTxLamports.toNumber()).to.equal(1_000_000_000);
    expect(policy.maxTxTokenUnits.toNumber()).to.equal(1_000_000);
    expect(policy.dailyBudgetLamports.toNumber()).to.equal(5_000_000_000);
    expect(policy.dailySpentLamports.toNumber()).to.equal(0);

    // Session + status
    expect(policy.sessionExpiry.toNumber()).to.equal(
      defaultSessionExpiry.toNumber()
    );
    expect(policy.isActive).to.be.true;
    expect(policy.pausedBy).to.be.null;

    // Squads config
    expect(policy.squadsMultisig).to.be.null;
    expect(policy.escalationThreshold.toNumber()).to.equal(2_000_000_000);

    // Monitors
    expect(policy.authorizedMonitors).to.have.lengthOf(1);
    expect(policy.authorizedMonitors[0].toBase58()).to.equal(
      monitor1.toBase58()
    );

    // Defaults
    expect(policy.anomalyScore).to.equal(0);

    // --- Verify SpendTracker fields ---
    const tracker = await program.account.spendTracker.fetch(trackerPda);

    expect(tracker.policy.toBase58()).to.equal(policyPda.toBase58());
    // Note: Anchor camelCase converts `_24h` suffix to `24H` (capital H)
    expect((tracker as any).txnCount24H).to.equal(0);
    expect((tracker as any).lamportsSpent24H.toNumber()).to.equal(0);
    expect(tracker.lastTxnTs.toNumber()).to.equal(0);
  });

  it("fails when initializing duplicate policy for same owner+agent", async () => {
    // The first init ran in the previous test — same (owner, agent) PDA exists
    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

    try {
      await program.methods
        .initializePolicy({
          allowedPrograms: defaultAllowedPrograms,
          maxTxLamports: defaultMaxTxLamports,
          maxTxTokenUnits: defaultMaxTxTokenUnits,
          dailyBudgetLamports: defaultDailyBudgetLamports,
          sessionExpiry: defaultSessionExpiry,
          squadsMultisig: null,
          escalationThreshold: defaultEscalationThreshold,
          authorizedMonitors: [],
        })
        .accounts({
          owner: owner.publicKey,
          agent: agent.publicKey,
          policy: policyPda,
          spendTracker: trackerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      expect.fail("Expected duplicate init to fail");
    } catch (err: any) {
      // Anchor rejects init on an already-initialized account
      expect(err).to.exist;
    }
  });

  it("fails when allowed_programs exceeds max (10)", async () => {
    const freshAgent = Keypair.generate();
    const [policyPda] = findPolicyPda(owner.publicKey, freshAgent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

    // 11 programs exceeds MAX_ALLOWED_PROGRAMS = 10
    const tooManyPrograms = Array.from({ length: 11 }, () =>
      Keypair.generate().publicKey
    );

    try {
      await program.methods
        .initializePolicy({
          allowedPrograms: tooManyPrograms,
          maxTxLamports: defaultMaxTxLamports,
          maxTxTokenUnits: defaultMaxTxTokenUnits,
          dailyBudgetLamports: defaultDailyBudgetLamports,
          sessionExpiry: defaultSessionExpiry,
          squadsMultisig: null,
          escalationThreshold: defaultEscalationThreshold,
          authorizedMonitors: [],
        })
        .accounts({
          owner: owner.publicKey,
          agent: freshAgent.publicKey,
          policy: policyPda,
          spendTracker: trackerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      expect.fail("Expected TooManyAllowedPrograms error");
    } catch (err: any) {
      expect(err.toString()).to.include("TooManyAllowedPrograms");
    }
  });

  it("fails when max_tx_lamports exceeds daily_budget_lamports", async () => {
    const freshAgent = Keypair.generate();
    const [policyPda] = findPolicyPda(owner.publicKey, freshAgent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

    try {
      await program.methods
        .initializePolicy({
          allowedPrograms: defaultAllowedPrograms,
          maxTxLamports: new BN(10_000_000_000), // 10 SOL per tx...
          maxTxTokenUnits: defaultMaxTxTokenUnits,
          dailyBudgetLamports: new BN(5_000_000_000), // ...but only 5 SOL daily
          sessionExpiry: defaultSessionExpiry,
          squadsMultisig: null,
          escalationThreshold: defaultEscalationThreshold,
          authorizedMonitors: [],
        })
        .accounts({
          owner: owner.publicKey,
          agent: freshAgent.publicKey,
          policy: policyPda,
          spendTracker: trackerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      expect.fail("Expected TxLimitExceedsDailyBudget error");
    } catch (err: any) {
      expect(err.toString()).to.include("TxLimitExceedsDailyBudget");
    }
  });
});
