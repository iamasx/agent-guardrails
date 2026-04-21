/**
 * Mock policies — mirrors `policies` table (server/prisma/schema.prisma)
 *
 * 3 agents matching the demo narrative:
 * - Yield Bot (trader): active, healthy
 * - Staking Agent (staker): active, healthy
 * - Alpha Scanner (attacker): paused after anomaly detection
 */

export interface Policy {
  pubkey: string;
  owner: string;
  agent: string;
  allowed_programs: string[];
  max_tx_lamports: number;
  daily_budget_lamports: number;
  session_expiry: string; // ISO 8601
  is_active: boolean;
  squads_multisig: string | null;
  escalation_threshold: number | null;
  anomaly_score: number; // 0–100
  label: string;
  created_at: string;
  updated_at: string;
}

// Known program addresses for labels
export const PROGRAM_LABELS: Record<string, string> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter v6",
  "MrNEdFKsp4MSGPoQwnZqSxUYEbBYaxQGTdCSg1vmDVJ": "Marinade Finance",
  "11111111111111111111111111111111": "System Program",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "Token Program",
};

// Shared owner wallet (the demo user)
const OWNER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

// Monitor wallet (worker's keypair)
export const MONITOR = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

export const POLICIES: Policy[] = [
  {
    pubkey: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    owner: OWNER,
    agent: "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
    allowed_programs: [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      "11111111111111111111111111111111",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ],
    max_tx_lamports: 5_000_000_000, // 5 SOL
    daily_budget_lamports: 50_000_000_000, // 50 SOL
    session_expiry: "2026-05-01T00:00:00Z",
    is_active: true,
    squads_multisig: "SMPLecH534Ngo6KPUV3GRbGN8D4BUXy4JUPq2YTJ1f",
    escalation_threshold: 10_000_000_000, // 10 SOL
    anomaly_score: 8,
    label: "Yield Bot",
    created_at: "2026-04-10T08:00:00Z",
    updated_at: "2026-04-21T14:30:00Z",
  },
  {
    pubkey: "8dHEsGNtQ2obTBbh8mxmXJ3A6stUdmKz1KfLFbm2WDNG",
    owner: OWNER,
    agent: "3Hk5ZxpWQna8JDVCvjMvQw5HGMFdZGPRBzDf9eMGx3hZ",
    allowed_programs: [
      "MrNEdFKsp4MSGPoQwnZqSxUYEbBYaxQGTdCSg1vmDVJ",
      "11111111111111111111111111111111",
    ],
    max_tx_lamports: 10_000_000_000, // 10 SOL
    daily_budget_lamports: 100_000_000_000, // 100 SOL
    session_expiry: "2026-05-01T00:00:00Z",
    is_active: true,
    squads_multisig: null,
    escalation_threshold: null,
    anomaly_score: 3,
    label: "Staking Agent",
    created_at: "2026-04-10T08:15:00Z",
    updated_at: "2026-04-21T12:00:00Z",
  },
  {
    pubkey: "CsZ5LZkDS7h9TDKjt4zMJSiP8bZzYLkWsa4bGMQKDqeE",
    owner: OWNER,
    agent: "J2HH7qPsULG5CzzDmPLsEikMm1CCEZop5qmdDsCuQAA",
    allowed_programs: [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      "11111111111111111111111111111111",
    ],
    max_tx_lamports: 2_000_000_000, // 2 SOL
    daily_budget_lamports: 20_000_000_000, // 20 SOL
    session_expiry: "2026-04-21T16:00:00Z",
    is_active: false,
    squads_multisig: null,
    escalation_threshold: null,
    anomaly_score: 87,
    label: "Alpha Scanner",
    created_at: "2026-04-15T10:00:00Z",
    updated_at: "2026-04-21T15:02:03Z",
  },
];
