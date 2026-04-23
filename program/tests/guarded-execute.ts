// Tests for the guarded_execute instruction (validation rejections + token program CPI).

// Standard deps imported directly from packages
import anchor from "@coral-xyz/anchor";
const { BN } = anchor;
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { Clock } from "litesvm";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Setup + helpers from helpers.ts
import {
  svm,
  program,
  findPolicyPda,
  findTrackerPda,
  buildSystemTransferData,
  buildTokenTransferData,
  getTokenBalance,
  createTestMint,
  createTestTokenAccount,
  mintTestTokens,
  defaultSessionExpiry,
} from "./helpers.js";

describe("guarded_execute", () => {
  // Fresh keypairs for guarded_execute tests (isolated from other test files)
  const geOwner = Keypair.generate();
  const geAgent = Keypair.generate();
  const destination = Keypair.generate();

  let gePolicyPda: PublicKey;
  let geTrackerPda: PublicKey;

  before(async () => {
    // Fund owner and agent
    svm.airdrop(geOwner.publicKey, 10_000_000_000n);
    svm.airdrop(geAgent.publicKey, 5_000_000_000n);

    // Derive PDAs
    [gePolicyPda] = findPolicyPda(geOwner.publicKey, geAgent.publicKey);
    [geTrackerPda] = findTrackerPda(gePolicyPda);

    // Create policy: System Program allowed, 1 SOL per-tx, 5 SOL daily
    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000), // 1 SOL
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000), // 5 SOL
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(2_000_000_000), // 2 SOL
        authorizedMonitors: [],
      })
      .accounts({
        owner: geOwner.publicKey,
        agent: geAgent.publicKey,
        policy: gePolicyPda,
        spendTracker: geTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([geOwner])
      .rpc();

    svm.airdrop(gePolicyPda, 5_000_000_000n); // 5 SOL for rent
  });

  // -----------------------------------------------------------------------
  // Validation rejection tests (steps 2-8 of the 12-step flow)
  // -----------------------------------------------------------------------

  it("rejects when target program is not whitelisted", async () => {
    const fakeProgram = Keypair.generate();
    const instructionData = Buffer.alloc(12);

    try {
      await program.methods
        .guardedExecute({
          instructionData: instructionData,
          amountHint: new BN(100_000),
        })
        .accounts({
          agent: geAgent.publicKey,
          policy: gePolicyPda,
          spendTracker: geTrackerPda,
          targetProgram: fakeProgram.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: gePolicyPda, isWritable: true, isSigner: false },
          { pubkey: destination.publicKey, isWritable: true, isSigner: false },
          { pubkey: fakeProgram.publicKey, isWritable: false, isSigner: false },
        ])
        .signers([geAgent])
        .rpc();

      expect.fail("Expected ProgramNotWhitelisted error");
    } catch (err: any) {
      expect(err.toString()).to.include("ProgramNotWhitelisted");
    }
  });

  it("rejects when amount exceeds per-tx limit", async () => {
    const tooBig = 2_000_000_000n; // 2 SOL > 1 SOL max
    const instructionData = buildSystemTransferData(tooBig);

    try {
      await program.methods
        .guardedExecute({
          instructionData: instructionData,
          amountHint: new BN(Number(tooBig)),
        })
        .accounts({
          agent: geAgent.publicKey,
          policy: gePolicyPda,
          spendTracker: geTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: gePolicyPda, isWritable: true, isSigner: false },
          { pubkey: destination.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([geAgent])
        .rpc();

      expect.fail("Expected AmountExceedsLimit error");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountExceedsLimit");
    }
  });

  it("rejects when amount_hint mismatches parsed System Program data", async () => {
    // amount_hint says 50k but instruction data says 200k -> AmountMismatch
    const realAmount = 200_000n;
    const instructionData = buildSystemTransferData(realAmount);

    try {
      await program.methods
        .guardedExecute({
          instructionData: instructionData,
          amountHint: new BN(50_000), // Lies about the amount
        })
        .accounts({
          agent: geAgent.publicKey,
          policy: gePolicyPda,
          spendTracker: geTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: gePolicyPda, isWritable: true, isSigner: false },
          { pubkey: destination.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([geAgent])
        .rpc();

      expect.fail("Expected AmountMismatch error");
    } catch (err: any) {
      expect(err.toString()).to.include("AmountMismatch");
    }
  });

  it("passes validation when amount is below escalation threshold (no EscalatedToMultisig)", async () => {
    // Create a policy with squads_multisig set and a high threshold.
    // A transfer below the threshold should NOT trigger escalation.
    // It will fail at CPI (System Program transfer from PDA without proper accounts)
    // but the error should be CpiExecutionFailed, NOT EscalatedToMultisig.
    const belowEscOwner = Keypair.generate();
    const belowEscAgent = Keypair.generate();
    svm.airdrop(belowEscOwner.publicKey, 10_000_000_000n);
    svm.airdrop(belowEscAgent.publicKey, 2_000_000_000n);

    const squadsMultisig = Keypair.generate().publicKey;

    const [bePolicyPda] = findPolicyPda(belowEscOwner.publicKey, belowEscAgent.publicKey);
    const [beTrackerPda] = findTrackerPda(bePolicyPda);

    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000), // 1 SOL
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000), // 5 SOL
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: squadsMultisig,
        escalationThreshold: new BN(500_000), // 500k lamports
        authorizedMonitors: [],
      })
      .accounts({
        owner: belowEscOwner.publicKey,
        agent: belowEscAgent.publicKey,
        policy: bePolicyPda,
        spendTracker: beTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([belowEscOwner])
      .rpc();

    svm.airdrop(bePolicyPda, 5_000_000_000n);

    // Transfer 100k (below 500k threshold) -- should NOT escalate
    const txData = buildSystemTransferData(100_000n);
    try {
      await program.methods
        .guardedExecute({
          instructionData: txData,
          amountHint: new BN(100_000),
        })
        .accounts({
          agent: belowEscAgent.publicKey,
          policy: bePolicyPda,
          spendTracker: beTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: bePolicyPda, isWritable: true, isSigner: false },
          { pubkey: destination.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([belowEscAgent])
        .rpc();

      // If it succeeds, that is fine -- no escalation happened
    } catch (err: any) {
      // If it fails, the error must NOT be EscalatedToMultisig.
      // CpiExecutionFailed or other errors are acceptable.
      expect(err.toString()).to.not.include("EscalatedToMultisig");
    }
  });

  it("passes validation when amount equals per-tx limit exactly (boundary)", async () => {
    // Create a policy with max_tx = 300k. Transferring exactly 300k should
    // pass the per-tx check (<=), not fail with AmountExceedsLimit.
    const boundaryOwner = Keypair.generate();
    const boundaryAgent = Keypair.generate();
    svm.airdrop(boundaryOwner.publicKey, 10_000_000_000n);
    svm.airdrop(boundaryAgent.publicKey, 2_000_000_000n);

    const [bPolicyPda] = findPolicyPda(boundaryOwner.publicKey, boundaryAgent.publicKey);
    const [bTrackerPda] = findTrackerPda(bPolicyPda);

    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(300_000), // 300k per tx
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000), // 5 SOL daily
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(10_000_000_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: boundaryOwner.publicKey,
        agent: boundaryAgent.publicKey,
        policy: bPolicyPda,
        spendTracker: bTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([boundaryOwner])
      .rpc();

    svm.airdrop(bPolicyPda, 5_000_000_000n);

    // Transfer exactly 300k (== max_tx_lamports) -- should pass validation
    const txData = buildSystemTransferData(300_000n);
    try {
      await program.methods
        .guardedExecute({
          instructionData: txData,
          amountHint: new BN(300_000),
        })
        .accounts({
          agent: boundaryAgent.publicKey,
          policy: bPolicyPda,
          spendTracker: bTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: bPolicyPda, isWritable: true, isSigner: false },
          { pubkey: destination.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([boundaryAgent])
        .rpc();

      // If it succeeds, the boundary check passed
    } catch (err: any) {
      // Should NOT fail with AmountExceedsLimit since 300k <= 300k
      expect(err.toString()).to.not.include("AmountExceedsLimit");
    }
  });

  it("trusts amount_hint for unknown programs (no AmountMismatch)", async () => {
    // Create a policy with a random program whitelisted. Call guarded_execute
    // targeting that program with arbitrary instruction data and amount_hint=0.
    // The amount parsing should fall through to the "unknown program" branch
    // and trust the hint. It will fail at CPI since the program does not exist,
    // but it must NOT fail with AmountMismatch.
    const unknownOwner = Keypair.generate();
    const unknownAgent = Keypair.generate();
    const fakeProgram = Keypair.generate();
    svm.airdrop(unknownOwner.publicKey, 10_000_000_000n);
    svm.airdrop(unknownAgent.publicKey, 2_000_000_000n);

    const [uPolicyPda] = findPolicyPda(unknownOwner.publicKey, unknownAgent.publicKey);
    const [uTrackerPda] = findTrackerPda(uPolicyPda);

    await program.methods
      .initializePolicy({
        allowedPrograms: [fakeProgram.publicKey],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(10_000_000_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: unknownOwner.publicKey,
        agent: unknownAgent.publicKey,
        policy: uPolicyPda,
        spendTracker: uTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([unknownOwner])
      .rpc();

    svm.airdrop(uPolicyPda, 5_000_000_000n);

    // Arbitrary instruction data that does not match System/Token format
    const arbitraryData = Buffer.from([0xff, 0xab, 0x01, 0x02, 0x03, 0x04]);
    try {
      await program.methods
        .guardedExecute({
          instructionData: arbitraryData,
          amountHint: new BN(0),
        })
        .accounts({
          agent: unknownAgent.publicKey,
          policy: uPolicyPda,
          spendTracker: uTrackerPda,
          targetProgram: fakeProgram.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: uPolicyPda, isWritable: true, isSigner: false },
          { pubkey: destination.publicKey, isWritable: true, isSigner: false },
          { pubkey: fakeProgram.publicKey, isWritable: false, isSigner: false },
        ])
        .signers([unknownAgent])
        .rpc();

      // If it succeeds, amount_hint was trusted
    } catch (err: any) {
      // Should NOT fail with AmountMismatch or ProgramNotWhitelisted
      expect(err.toString()).to.not.include("AmountMismatch");
      expect(err.toString()).to.not.include("ProgramNotWhitelisted");
    }
  });

  // NOTE: DailyBudgetExceeded requires cumulative spending from prior
  // successful CPIs. Tested when Token Program CPI is integrated.

  it("rejects when session has expired", async () => {
    // Create a policy with a session_expiry just 10 seconds from 'now'
    const expiryAgent = Keypair.generate();
    svm.airdrop(expiryAgent.publicKey, 2_000_000_000n);

    // Get current clock timestamp from LiteSVM
    const currentClock = svm.getClock();
    const shortExpiry = new BN(Number(currentClock.unixTimestamp) + 10);

    const [ePolicyPda] = findPolicyPda(geOwner.publicKey, expiryAgent.publicKey);
    const [eTrackerPda] = findTrackerPda(ePolicyPda);

    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(1_000_000_000),
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(5_000_000_000),
        sessionExpiry: shortExpiry,
        squadsMultisig: null,
        escalationThreshold: new BN(10_000_000_000),
        authorizedMonitors: [],
      })
      .accounts({
        owner: geOwner.publicKey,
        agent: expiryAgent.publicKey,
        policy: ePolicyPda,
        spendTracker: eTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([geOwner])
      .rpc();

    svm.airdrop(ePolicyPda, 2_000_000_000n);

    // Warp clock past session_expiry, with clock restoration in finally
    try {
      svm.setClock(new Clock(
        currentClock.slot + 100n,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(shortExpiry.toNumber() + 100),
      ));

      const txData = buildSystemTransferData(100_000n);
      await program.methods
        .guardedExecute({
          instructionData: txData,
          amountHint: new BN(100_000),
        })
        .accounts({
          agent: expiryAgent.publicKey,
          policy: ePolicyPda,
          spendTracker: eTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: ePolicyPda, isWritable: true, isSigner: false },
          { pubkey: destination.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([expiryAgent])
        .rpc();

      expect.fail("Expected SessionExpired error");
    } catch (err: any) {
      expect(err.toString()).to.include("SessionExpired");
    } finally {
      svm.setClock(currentClock);
    }
  });

  it("rejects with EscalatedToMultisig when amount > threshold and squads set", async () => {
    // Create a policy with squads_multisig set and low escalation threshold
    const escAgent = Keypair.generate();
    svm.airdrop(escAgent.publicKey, 2_000_000_000n);

    const squadsMultisig = Keypair.generate().publicKey;

    const [escPolicyPda] = findPolicyPda(geOwner.publicKey, escAgent.publicKey);
    const [escTrackerPda] = findTrackerPda(escPolicyPda);

    await program.methods
      .initializePolicy({
        allowedPrograms: [SystemProgram.programId],
        maxTxLamports: new BN(2_000_000_000), // 2 SOL
        maxTxTokenUnits: new BN(1_000_000),
        dailyBudgetLamports: new BN(10_000_000_000), // 10 SOL
        sessionExpiry: defaultSessionExpiry,
        squadsMultisig: squadsMultisig,
        escalationThreshold: new BN(500_000_000), // 0.5 SOL
        authorizedMonitors: [],
      })
      .accounts({
        owner: geOwner.publicKey,
        agent: escAgent.publicKey,
        policy: escPolicyPda,
        spendTracker: escTrackerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([geOwner])
      .rpc();

    svm.airdrop(escPolicyPda, 5_000_000_000n);

    // Try 1 SOL transfer (> 0.5 SOL threshold) -> should escalate
    const txData = buildSystemTransferData(1_000_000_000n);
    try {
      await program.methods
        .guardedExecute({
          instructionData: txData,
          amountHint: new BN(1_000_000_000),
        })
        .accounts({
          agent: escAgent.publicKey,
          policy: escPolicyPda,
          spendTracker: escTrackerPda,
          targetProgram: SystemProgram.programId,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: escPolicyPda, isWritable: true, isSigner: false },
          { pubkey: destination.publicKey, isWritable: true, isSigner: false },
          { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([escAgent])
        .rpc();

      expect.fail("Expected EscalatedToMultisig error");
    } catch (err: any) {
      expect(err.toString()).to.include("EscalatedToMultisig");
    }
  });

  // -----------------------------------------------------------------------
  // Token Program CPI tests (happy path + budget enforcement)
  // -----------------------------------------------------------------------

  describe("token program CPI", () => {
    const tOwner = Keypair.generate();
    const tAgent = Keypair.generate();
    const mintAuthority = Keypair.generate();
    const mintKeypair = Keypair.generate();
    const sourceTokenKeypair = Keypair.generate();
    const destTokenKeypair = Keypair.generate();

    let tPolicyPda: PublicKey;
    let tTrackerPda: PublicKey;

    // Transfer 300k per tx. Policy: max_tx=500k, daily=800k.
    // Narrative: tx1(300k ok) -> tx2(600k ok) -> tx3(900k>800k rejected) -> warp 24h -> tx4(300k ok)
    const TRANSFER_AMOUNT = 300_000n;

    before(async () => {
      svm.airdrop(tOwner.publicKey, 10_000_000_000n);
      svm.airdrop(tAgent.publicKey, 5_000_000_000n);
      svm.airdrop(mintAuthority.publicKey, 5_000_000_000n);

      [tPolicyPda] = findPolicyPda(tOwner.publicKey, tAgent.publicKey);
      [tTrackerPda] = findTrackerPda(tPolicyPda);

      // Create policy with Token Program whitelisted
      await program.methods
        .initializePolicy({
          allowedPrograms: [TOKEN_PROGRAM_ID],
          maxTxLamports: new BN(500_000),
          maxTxTokenUnits: new BN(1_000_000),
          dailyBudgetLamports: new BN(800_000),
          sessionExpiry: defaultSessionExpiry,
          squadsMultisig: null,
          escalationThreshold: new BN(10_000_000_000),
          authorizedMonitors: [],
        })
        .accounts({
          owner: tOwner.publicKey,
          agent: tAgent.publicKey,
          policy: tPolicyPda,
          spendTracker: tTrackerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([tOwner])
        .rpc();

      // Create mint
      await createTestMint(mintKeypair, mintAuthority.publicKey, 6);

      // Create source token account: authority = policy PDA
      await createTestTokenAccount(sourceTokenKeypair, mintKeypair.publicKey, tPolicyPda);

      // Create destination token account
      await createTestTokenAccount(
        destTokenKeypair,
        mintKeypair.publicKey,
        Keypair.generate().publicKey,
      );

      // Mint tokens into source
      await mintTestTokens(
        mintKeypair.publicKey,
        sourceTokenKeypair.publicKey,
        mintAuthority,
        5_000_000n,
      );
    });

    it("transfers tokens via guarded_execute and verifies balances", async () => {
      const instructionData = buildTokenTransferData(TRANSFER_AMOUNT);
      const srcBefore = getTokenBalance(sourceTokenKeypair.publicKey);
      const dstBefore = getTokenBalance(destTokenKeypair.publicKey);

      await program.methods
        .guardedExecute({
          instructionData: instructionData,
          amountHint: new BN(Number(TRANSFER_AMOUNT)),
        })
        .accounts({
          agent: tAgent.publicKey,
          policy: tPolicyPda,
          spendTracker: tTrackerPda,
          targetProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: sourceTokenKeypair.publicKey, isWritable: true, isSigner: false },
          { pubkey: destTokenKeypair.publicKey, isWritable: true, isSigner: false },
          { pubkey: tPolicyPda, isWritable: false, isSigner: false },
          { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
        ])
        .signers([tAgent])
        .rpc();

      // Verify token balances changed
      expect(getTokenBalance(sourceTokenKeypair.publicKey)).to.equal(srcBefore - TRANSFER_AMOUNT);
      expect(getTokenBalance(destTokenKeypair.publicKey)).to.equal(dstBefore + TRANSFER_AMOUNT);
    });

    it("updates SpendTracker and policy counters after successful transfer", async () => {
      const tracker = await program.account.spendTracker.fetch(tTrackerPda);
      expect((tracker as any).txnCount24H).to.equal(1);
      expect((tracker as any).lamportsSpent24H.toNumber()).to.equal(Number(TRANSFER_AMOUNT));
      expect(tracker.lastTxnProgram.toBase58()).to.equal(TOKEN_PROGRAM_ID.toBase58());

      const policy = await program.account.permissionPolicy.fetch(tPolicyPda);
      expect(policy.dailySpentLamports.toNumber()).to.equal(Number(TRANSFER_AMOUNT));
    });

    it("rejects third transfer that would exceed daily budget", async () => {
      // Second transfer: 200k -> cumulative = 500k < 800k daily budget -> succeeds
      // (Use different amount than first transfer to avoid LiteSVM tx dedup)
      const secondAmount = 200_000n;
      await program.methods
        .guardedExecute({
          instructionData: buildTokenTransferData(secondAmount),
          amountHint: new BN(Number(secondAmount)),
        })
        .accounts({
          agent: tAgent.publicKey,
          policy: tPolicyPda,
          spendTracker: tTrackerPda,
          targetProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: sourceTokenKeypair.publicKey, isWritable: true, isSigner: false },
          { pubkey: destTokenKeypair.publicKey, isWritable: true, isSigner: false },
          { pubkey: tPolicyPda, isWritable: false, isSigner: false },
          { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
        ])
        .signers([tAgent])
        .rpc();

      // Verify cumulative = 500k (300k + 200k) after 2 transfers
      const tracker = await program.account.spendTracker.fetch(tTrackerPda);
      expect((tracker as any).txnCount24H).to.equal(2);
      expect((tracker as any).lamportsSpent24H.toNumber()).to.equal(500_000);

      // Third transfer of 400k: cumulative would be 900k > 800k -> DailyBudgetExceeded
      const thirdAmount = 400_000n;
      try {
        await program.methods
          .guardedExecute({
            instructionData: buildTokenTransferData(thirdAmount),
            amountHint: new BN(Number(thirdAmount)),
          })
          .accounts({
            agent: tAgent.publicKey,
            policy: tPolicyPda,
            spendTracker: tTrackerPda,
            targetProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts([
            { pubkey: sourceTokenKeypair.publicKey, isWritable: true, isSigner: false },
            { pubkey: destTokenKeypair.publicKey, isWritable: true, isSigner: false },
            { pubkey: tPolicyPda, isWritable: false, isSigner: false },
            { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
          ])
          .signers([tAgent])
          .rpc();

        expect.fail("Expected DailyBudgetExceeded error");
      } catch (err: any) {
        expect(err.toString()).to.include("DailyBudgetExceeded");
      }
    });

    it("allows spending again after 24h budget window rollover", async () => {
      // Current state: daily_spent = 500k, daily_budget = 800k
      // Warp clock 25 hours -> budget resets to 0 -> 250k should succeed
      const rolloverAmount = 250_000n; // Unique amount to avoid tx dedup
      const currentClock = svm.getClock();
      try {
        svm.setClock(new Clock(
          currentClock.slot + 1000n,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          currentClock.unixTimestamp + 90_000n, // +25 hours
        ));

        const srcBefore = getTokenBalance(sourceTokenKeypair.publicKey);

        await program.methods
          .guardedExecute({
            instructionData: buildTokenTransferData(rolloverAmount),
            amountHint: new BN(Number(rolloverAmount)),
          })
          .accounts({
            agent: tAgent.publicKey,
            policy: tPolicyPda,
            spendTracker: tTrackerPda,
            targetProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts([
            { pubkey: sourceTokenKeypair.publicKey, isWritable: true, isSigner: false },
            { pubkey: destTokenKeypair.publicKey, isWritable: true, isSigner: false },
            { pubkey: tPolicyPda, isWritable: false, isSigner: false },
            { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
          ])
          .signers([tAgent])
          .rpc();

        // Verify transfer went through
        expect(getTokenBalance(sourceTokenKeypair.publicKey)).to.equal(
          srcBefore - rolloverAmount
        );

        // Verify counters reset — only this transfer in the new window
        const tracker = await program.account.spendTracker.fetch(tTrackerPda);
        expect((tracker as any).txnCount24H).to.equal(1);
        expect((tracker as any).lamportsSpent24H.toNumber()).to.equal(Number(rolloverAmount));

        const policy = await program.account.permissionPolicy.fetch(tPolicyPda);
        expect(policy.dailySpentLamports.toNumber()).to.equal(Number(rolloverAmount));
      } finally {
        svm.setClock(currentClock);
      }
    });

    it("rejects when amount_hint mismatches Token Program instruction data", async () => {
      const realAmount = 200_000n;
      const instructionData = buildTokenTransferData(realAmount);

      try {
        await program.methods
          .guardedExecute({
            instructionData: instructionData,
            amountHint: new BN(50_000), // Lies about the amount
          })
          .accounts({
            agent: tAgent.publicKey,
            policy: tPolicyPda,
            spendTracker: tTrackerPda,
            targetProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts([
            { pubkey: sourceTokenKeypair.publicKey, isWritable: true, isSigner: false },
            { pubkey: destTokenKeypair.publicKey, isWritable: true, isSigner: false },
            { pubkey: tPolicyPda, isWritable: false, isSigner: false },
            { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
          ])
          .signers([tAgent])
          .rpc();

        expect.fail("Expected AmountMismatch error");
      } catch (err: any) {
        expect(err.toString()).to.include("AmountMismatch");
      }
    });
  });
});
