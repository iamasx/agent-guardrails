// Shared helpers for demo scripts — keypair management, connection, client setup.

import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { GuardrailsClient } from "../lib/sdk/client";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_KEYS_PATH = path.join(__dirname, "..", ".demo-keys.json");

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID;

if (!PROGRAM_ID) {
  throw new Error(
    "NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID env var required. Set it in dashboard/.env.local",
  );
}

export const PROGRAM_PUBKEY = new PublicKey(PROGRAM_ID);

// ---------------------------------------------------------------------------
// Demo keypair storage
// ---------------------------------------------------------------------------

export interface DemoKeys {
  owner: number[];
  monitor: number[];
  trader: number[];
  staker: number[];
  attacker: number[];
}

export function saveDemoKeys(keys: DemoKeys): void {
  fs.writeFileSync(DEMO_KEYS_PATH, JSON.stringify(keys, null, 2));
  console.log(`[demo] Keys saved to ${DEMO_KEYS_PATH}`);
}

export function loadDemoKeys(): DemoKeys {
  if (!fs.existsSync(DEMO_KEYS_PATH)) {
    throw new Error(
      `Demo keys not found at ${DEMO_KEYS_PATH}. Run 'npm run demo:setup' first.`,
    );
  }
  return JSON.parse(fs.readFileSync(DEMO_KEYS_PATH, "utf-8"));
}

export function keypairFromArray(arr: number[]): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

// ---------------------------------------------------------------------------
// Connection & client factories
// ---------------------------------------------------------------------------

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export function getClient(wallet: Keypair): GuardrailsClient {
  const connection = getConnection();
  const provider = new AnchorProvider(connection, new Wallet(wallet), {
    commitment: "confirmed",
  });
  return new GuardrailsClient(provider, PROGRAM_PUBKEY);
}

// ---------------------------------------------------------------------------
// System Program transfer helpers
// ---------------------------------------------------------------------------

/** Build System Program Transfer instruction data (index=2, then u64 LE lamports). */
export function buildTransferIxData(lamports: bigint): Buffer {
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2, 0); // Transfer instruction index
  data.writeBigUInt64LE(lamports, 4);
  return data;
}

/**
 * Execute a guarded System Program SOL transfer from the policy PDA to a destination.
 *
 * remaining_accounts layout for System Program transfer CPI:
 *   [0] policy PDA (writable) — source, will be marked as signer by handler
 *   [1] destination (writable) — recipient
 *   [2] System Program — target program for invoke_signed resolution
 */
export async function guardedSolTransfer(
  client: GuardrailsClient,
  agentKeypair: Keypair,
  policyPda: PublicKey,
  trackerPda: PublicKey,
  destination: PublicKey,
  lamports: number,
): Promise<string> {
  const ixData = buildTransferIxData(BigInt(lamports));

  return client.guardedExecute(
    agentKeypair,
    policyPda,
    trackerPda,
    SystemProgram.programId,
    {
      instructionData: ixData,
      amountHint: new BN(lamports),
    },
    [
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function shortKey(pubkey: PublicKey): string {
  const s = pubkey.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function solAmount(lamports: number): string {
  return `${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Request an airdrop and wait for confirmation. Retries once on failure. */
export async function airdropSol(
  connection: Connection,
  pubkey: PublicKey,
  sol: number,
): Promise<void> {
  console.log(`[demo] Airdropping ${sol} SOL to ${shortKey(pubkey)}…`);
  try {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  } catch {
    // Devnet airdrop can fail — retry once after a pause
    await sleep(2000);
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }
}
