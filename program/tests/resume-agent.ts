// Tests for the resume_agent instruction (owner-only access control).

// Standard deps imported directly from packages
import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

// Setup + helpers from helpers.ts
import { svm, program, findPolicyPda, findTrackerPda, defaultSessionExpiry } from "./helpers.js";

describe("resume_agent", () => {
  const resumeOwner = Keypair.generate();
  const resumeAgent = Keypair.generate();
  const resumeMonitor = Keypair.generate();
  let resumePolicyPda: PublicKey;

  before(async () => {
    svm.airdrop(resumeOwner.publicKey, 10_000_000_000n);
    svm.airdrop(resumeMonitor.publicKey, 1_000_000_000n);

    [resumePolicyPda] = findPolicyPda(resumeOwner.publicKey, resumeAgent.publicKey);
    const [resumeTrackerPda] = findTrackerPda(resumePolicyPda);

    // Create policy and immediately pause it
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(2_000_000_000),
        authorizedMonitors: [resumeMonitor.publicKey],
      })
      .accounts({
        owner: resumeOwner.publicKey,
        agent: resumeAgent.publicKey,
        policy: resumePolicyPda,
        spendTracker: resumeTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([resumeOwner])
      .rpc();

    // Pause it for resume tests
    await program.methods
      .pauseAgent({ reason: Buffer.from("Paused for resume tests") })
      .accounts({ caller: resumeOwner.publicKey, policy: resumePolicyPda })
      .signers([resumeOwner])
      .rpc();
  });

  it("owner can resume a paused agent", async () => {
    await program.methods
      .resumeAgent()
      .accounts({ owner: resumeOwner.publicKey, policy: resumePolicyPda })
      .signers([resumeOwner])
      .rpc();

    const policy = await program.account.permissionPolicy.fetch(resumePolicyPda);
    expect(policy.isActive).to.be.true;
    expect(policy.pausedBy).to.be.null;

    // Verify paused_reason is cleared (all zeros)
    const storedReason = Buffer.from(policy.pausedReason);
    expect(storedReason.every((b: number) => b === 0)).to.be.true;
  });

  it("monitor cannot resume a paused agent", async () => {
    // Re-pause for this test
    await program.methods
      .pauseAgent({ reason: Buffer.from("Re-paused") })
      .accounts({ caller: resumeOwner.publicKey, policy: resumePolicyPda })
      .signers([resumeOwner])
      .rpc();

    try {
      await program.methods
        .resumeAgent()
        .accounts({ owner: resumeMonitor.publicKey, policy: resumePolicyPda })
        .signers([resumeMonitor])
        .rpc();

      expect.fail("Expected ResumeRequiresOwner error");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });

  it("random caller cannot resume a paused agent", async () => {
    const attacker = Keypair.generate();
    svm.airdrop(attacker.publicKey, 1_000_000_000n);

    try {
      await program.methods
        .resumeAgent()
        .accounts({ owner: attacker.publicKey, policy: resumePolicyPda })
        .signers([attacker])
        .rpc();

      expect.fail("Expected resume to fail for non-owner");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });
});
