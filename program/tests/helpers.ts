// helpers.ts — Shared test setup: SVM instance, program, PDA helpers, token helpers.
//
// Test files import setup + helpers from here, and import standard deps
// (BN, Keypair, expect, etc.) directly from their packages.

import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import anchor from "@coral-xyz/anchor";
const { Program, BN } = anchor;
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createRequire } from "module";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  ACCOUNT_SIZE,
  createInitializeMintInstruction,
  createInitializeAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";

// ---------------------------------------------------------------------------
// SVM + Program setup (shared across all test files)
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const IDL = require("../target/idl/guardrails.json");

// Note: don't use withDefaultPrograms() — it loads ALL SPL programs into the
// in-process VM and causes std::bad_alloc on CI runners. System Program and
// SPL Token are already available in the base LiteSVM instance.
export const svm = fromWorkspace(".");
export const provider = new LiteSVMProvider(svm);
export const program = new Program(IDL, provider);

// ---------------------------------------------------------------------------
// PDA derivation helpers
// ---------------------------------------------------------------------------

export function findPolicyPda(
  ownerKey: PublicKey,
  agentKey: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), ownerKey.toBuffer(), agentKey.toBuffer()],
    program.programId,
  );
}

export function findTrackerPda(policyKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tracker"), policyKey.toBuffer()],
    program.programId,
  );
}

// ---------------------------------------------------------------------------
// Token Program helpers
// ---------------------------------------------------------------------------

export async function createTestMint(
  mintKeypair: Keypair,
  authority: PublicKey,
  decimals: number = 6,
): Promise<PublicKey> {
  const rentExempt = svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE));
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: Number(rentExempt),
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mintKeypair.publicKey, decimals, authority, null),
  );
  await provider.sendAndConfirm!(tx, [mintKeypair]);
  return mintKeypair.publicKey;
}

export async function createTestTokenAccount(
  accountKeypair: Keypair,
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  const rentExempt = svm.minimumBalanceForRentExemption(BigInt(ACCOUNT_SIZE));
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: accountKeypair.publicKey,
      space: ACCOUNT_SIZE,
      lamports: Number(rentExempt),
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeAccountInstruction(accountKeypair.publicKey, mint, owner),
  );
  await provider.sendAndConfirm!(tx, [accountKeypair]);
  return accountKeypair.publicKey;
}

export async function mintTestTokens(
  mint: PublicKey,
  destination: PublicKey,
  mintAuthority: Keypair,
  amount: bigint,
): Promise<void> {
  const tx = new Transaction().add(
    createMintToInstruction(mint, destination, mintAuthority.publicKey, amount),
  );
  await provider.sendAndConfirm!(tx, [mintAuthority]);
}

// ---------------------------------------------------------------------------
// Instruction data builders
// ---------------------------------------------------------------------------

const U64_MAX = (1n << 64n) - 1n;

export function buildSystemTransferData(lamports: bigint): Buffer {
  if (lamports < 0n || lamports > U64_MAX) {
    throw new RangeError(`lamports must be a valid u64, got ${lamports}`);
  }
  const buf = Buffer.alloc(12);
  buf.writeUInt32LE(2, 0);
  buf.writeBigUInt64LE(lamports, 4);
  return buf;
}

export function buildTokenTransferData(amount: bigint): Buffer {
  if (amount < 0n || amount > U64_MAX) {
    throw new RangeError(`amount must be a valid u64, got ${amount}`);
  }
  const buf = Buffer.alloc(9);
  buf.writeUInt8(3, 0);
  buf.writeBigUInt64LE(amount, 1);
  return buf;
}

export function getTokenBalance(tokenAccount: PublicKey): bigint {
  const accountInfo = svm.getAccount(tokenAccount);
  if (!accountInfo) throw new Error(`Token account ${tokenAccount.toBase58()} not found`);
  const data = Buffer.from(accountInfo.data);
  if (data.length < 72) {
    throw new Error(
      `Invalid token account data for ${tokenAccount.toBase58()}: expected >= 72 bytes, got ${data.length}`,
    );
  }
  return data.readBigUInt64LE(64);
}

// ---------------------------------------------------------------------------
// Default policy args
// ---------------------------------------------------------------------------

export const defaultSessionExpiry = new BN(
  Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
);
