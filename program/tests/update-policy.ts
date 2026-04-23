// Tests for the update_policy instruction (field updates, access control, validation).

// Standard deps imported directly from packages
import anchor from "@coral-xyz/anchor";
const { BN } = anchor;
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { Clock } from "litesvm";

// Setup + helpers from helpers.ts
import { svm, program, findPolicyPda, findTrackerPda, defaultSessionExpiry } from "./helpers.js";

// Constants formerly exported from helpers — defined locally
const defaultAllowedPrograms = [SystemProgram.programId];
const defaultMaxTxLamports = new BN(1_000_000_000);
const defaultMaxTxTokenUnits = new BN(1_000_000);
const defaultDailyBudgetLamports = new BN(5_000_000_000);
const defaultEscalationThreshold = new BN(2_000_000_000);

describe("update_policy", () => {
  const owner = Keypair.generate();
  const agent = Keypair.generate();

  before(async () => {
    svm.airdrop(owner.publicKey, 10_000_000_000n);

    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);
    const [trackerPda] = findTrackerPda(policyPda);

    // Create the policy that update tests will operate on
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
  });

  it("owner can update limits and verify changes", async () => {
    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);

    const newProgram = Keypair.generate().publicKey;
    const newMonitor = Keypair.generate().publicKey;

    await program.methods
      .updatePolicy({
        allowedPrograms: [SystemProgram.programId, newProgram],
        maxTxLamports: new BN(2_000_000_000), // 2 SOL
        maxTxTokenUnits: new BN(2_000_000),
        dailyBudgetLamports: new BN(10_000_000_000), // 10 SOL
        sessionExpiry: null, // unchanged
        squadsMultisig: null, // unchanged
        escalationThreshold: new BN(5_000_000_000), // 5 SOL
        authorizedMonitors: [newMonitor],
        anomalyScore: 42,
      })
      .accounts({
        owner: owner.publicKey,
        policy: policyPda,
      })
      .signers([owner])
      .rpc();

    const policy = await program.account.permissionPolicy.fetch(policyPda);

    // Updated fields
    expect(policy.allowedPrograms).to.have.lengthOf(2);
    expect(policy.allowedPrograms[1].toBase58()).to.equal(
      newProgram.toBase58()
    );
    expect(policy.maxTxLamports.toNumber()).to.equal(2_000_000_000);
    expect(policy.maxTxTokenUnits.toNumber()).to.equal(2_000_000);
    expect(policy.dailyBudgetLamports.toNumber()).to.equal(10_000_000_000);
    expect(policy.escalationThreshold.toNumber()).to.equal(5_000_000_000);
    expect(policy.authorizedMonitors).to.have.lengthOf(1);
    expect(policy.authorizedMonitors[0].toBase58()).to.equal(
      newMonitor.toBase58()
    );
    expect(policy.anomalyScore).to.equal(42);

    // Unchanged fields (passed as null -> None -> no update)
    expect(policy.sessionExpiry.toNumber()).to.equal(
      defaultSessionExpiry.toNumber()
    );
  });

  it("non-owner cannot update policy", async () => {
    const attacker = Keypair.generate();
    svm.airdrop(attacker.publicKey, 1_000_000_000n); // 1 SOL for fees

    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);

    // Capture state before the unauthorized attempt
    const before = await program.account.permissionPolicy.fetch(policyPda);

    try {
      await program.methods
        .updatePolicy({
          allowedPrograms: null,
          maxTxLamports: new BN(999_999_999),
          maxTxTokenUnits: null,
          dailyBudgetLamports: null,
          sessionExpiry: null,
          squadsMultisig: null,
          escalationThreshold: null,
          authorizedMonitors: null,
          anomalyScore: null,
        })
        .accounts({
          owner: attacker.publicKey,
          policy: policyPda,
        })
        .signers([attacker])
        .rpc();

      expect.fail("Expected non-owner update to fail");
    } catch (err: any) {
      // has_one constraint rejects because attacker.key != policy.owner
      expect(err).to.exist;
    }

    // Verify policy state was NOT mutated by the failed attempt
    const after = await program.account.permissionPolicy.fetch(policyPda);
    expect(after.maxTxLamports.toString()).to.equal(before.maxTxLamports.toString());
  });

  it("fails when updating allowed_programs above max (10)", async () => {
    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);

    // 11 programs exceeds MAX_ALLOWED_PROGRAMS = 10
    const tooManyPrograms = Array.from({ length: 11 }, () =>
      Keypair.generate().publicKey
    );

    try {
      await program.methods
        .updatePolicy({
          allowedPrograms: tooManyPrograms,
          maxTxLamports: null,
          maxTxTokenUnits: null,
          dailyBudgetLamports: null,
          sessionExpiry: null,
          squadsMultisig: null,
          escalationThreshold: null,
          authorizedMonitors: null,
          anomalyScore: null,
        })
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
        })
        .signers([owner])
        .rpc();

      expect.fail("Expected TooManyAllowedPrograms error");
    } catch (err: any) {
      expect(err.toString()).to.include("TooManyAllowedPrograms");
    }
  });

  it("fails when updating session_expiry to a past timestamp", async () => {
    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);

    // Get current clock time and set expiry to 100 seconds before it
    const currentClock = svm.getClock();
    const pastExpiry = new BN(Number(currentClock.unixTimestamp) - 100);

    try {
      await program.methods
        .updatePolicy({
          allowedPrograms: null,
          maxTxLamports: null,
          maxTxTokenUnits: null,
          dailyBudgetLamports: null,
          sessionExpiry: pastExpiry,
          squadsMultisig: null,
          escalationThreshold: null,
          authorizedMonitors: null,
          anomalyScore: null,
        })
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
        })
        .signers([owner])
        .rpc();

      expect.fail("Expected SessionExpiryInPast error");
    } catch (err: any) {
      expect(err.toString()).to.include("SessionExpiryInPast");
    }
  });

  it("fails when updating authorized_monitors above max (3)", async () => {
    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);

    // 4 monitors exceeds MAX_AUTHORIZED_MONITORS = 3
    const tooManyMonitors = Array.from({ length: 4 }, () =>
      Keypair.generate().publicKey
    );

    try {
      await program.methods
        .updatePolicy({
          allowedPrograms: null,
          maxTxLamports: null,
          maxTxTokenUnits: null,
          dailyBudgetLamports: null,
          sessionExpiry: null,
          squadsMultisig: null,
          escalationThreshold: null,
          authorizedMonitors: tooManyMonitors,
          anomalyScore: null,
        })
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
        })
        .signers([owner])
        .rpc();

      expect.fail("Expected TooManyMonitors error");
    } catch (err: any) {
      expect(err.toString()).to.include("TooManyMonitors");
    }
  });

  it("fails when daily_budget_lamports is updated below existing max_tx_lamports", async () => {
    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);

    // The first test updated this policy to max_tx=2 SOL, daily=10 SOL.
    // Setting daily_budget to 1 SOL (< 2 SOL max_tx) should trigger coherence check.
    try {
      await program.methods
        .updatePolicy({
          allowedPrograms: null,
          maxTxLamports: null,
          maxTxTokenUnits: null,
          dailyBudgetLamports: new BN(1_000_000_000), // 1 SOL < 2 SOL max_tx
          sessionExpiry: null,
          squadsMultisig: null,
          escalationThreshold: null,
          authorizedMonitors: null,
          anomalyScore: null,
        })
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
        })
        .signers([owner])
        .rpc();

      expect.fail("Expected TxLimitExceedsDailyBudget error");
    } catch (err: any) {
      expect(err.toString()).to.include("TxLimitExceedsDailyBudget");
    }
  });

  it("clears squads_multisig when updated with Pubkey::default()", async () => {
    const [policyPda] = findPolicyPda(owner.publicKey, agent.publicKey);

    // First, set squads_multisig to some pubkey
    const someMultisig = Keypair.generate().publicKey;
    await program.methods
      .updatePolicy({
        allowedPrograms: null,
        maxTxLamports: null,
        maxTxTokenUnits: null,
        dailyBudgetLamports: null,
        sessionExpiry: null,
        squadsMultisig: someMultisig,
        escalationThreshold: null,
        authorizedMonitors: null,
        anomalyScore: null,
      })
      .accounts({
        owner: owner.publicKey,
        policy: policyPda,
      })
      .signers([owner])
      .rpc();

    // Verify it was set
    let policy = await program.account.permissionPolicy.fetch(policyPda);
    expect(policy.squadsMultisig).to.not.be.null;
    expect(policy.squadsMultisig.toBase58()).to.equal(someMultisig.toBase58());

    // Now clear it using Pubkey::default() (all zeros)
    const defaultPubkey = new PublicKey(new Uint8Array(32));
    await program.methods
      .updatePolicy({
        allowedPrograms: null,
        maxTxLamports: null,
        maxTxTokenUnits: null,
        dailyBudgetLamports: null,
        sessionExpiry: null,
        squadsMultisig: defaultPubkey,
        escalationThreshold: null,
        authorizedMonitors: null,
        anomalyScore: null,
      })
      .accounts({
        owner: owner.publicKey,
        policy: policyPda,
      })
      .signers([owner])
      .rpc();

    // Verify it was cleared to null
    policy = await program.account.permissionPolicy.fetch(policyPda);
    expect(policy.squadsMultisig).to.be.null;
  });
});
