/**
 * Mock policies — mirrors `policies` table (server/prisma/schema.prisma)
 *
 * 5 agents matching the demo narrative:
 * - Yield Bot (trader): active, healthy, Squads escalation configured
 * - Staking Agent (staker): active, healthy, no escalation
 * - Alpha Scanner (attacker): paused after anomaly detection
 * - Treasury Manager: active, high limits, Squads configured
 * - Test Agent: expired session, label is null
 *
 * BigInt fields (maxTxLamports, dailyBudgetLamports, escalationThreshold)
 * are serialized as strings — matches what the server API returns via JSON.
 */

export interface Policy {
  pubkey: string;
  owner: string;
  agent: string;
  allowedPrograms: string[];
  maxTxLamports: string;          // BigInt serialized as string
  dailyBudgetLamports: string;    // BigInt serialized as string
  dailySpentLamports?: string;    // BigInt serialized as string (optional for backward compatibility)
  sessionExpiry: string;          // ISO 8601
  isActive: boolean;
  squadsMultisig: string | null;
  escalationThreshold: string | null; // BigInt serialized as string
  anomalyScore: number;           // 0–100
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

// Known program addresses for labels
export const PROGRAM_LABELS: Record<string, string> = {
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "Jupiter v6",
  MrNEdFKsp4MSGPoQwnZqSxUYEbBYaxQGTdCSg1vmDVJ: "Marinade Finance",
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "Token Program",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "Unknown (DezX...B263)",
};

// Shared owner wallet (the demo user)
const OWNER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

// Monitor wallet (server's keypair)
export const MONITOR = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

export const POLICIES: Policy[] = [
  {
    pubkey: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    owner: OWNER,
    agent: "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
    allowedPrograms: [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      "11111111111111111111111111111111",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ],
    maxTxLamports: "5000000000",           // 5 SOL
    dailyBudgetLamports: "50000000000",    // 50 SOL
    sessionExpiry: "2026-05-01T00:00:00Z",
    isActive: true,
    squadsMultisig: "SMPLecH534Ngo6KPUV3GRbGN8D4BUXy4JUPq2YTJ1f",
    escalationThreshold: "10000000000",    // 10 SOL
    anomalyScore: 8,
    label: "Yield Bot",
    createdAt: "2026-04-10T08:00:00Z",
    updatedAt: "2026-04-21T14:30:00Z",
  },
  {
    pubkey: "8dHEsGNtQ2obTBbh8mxmXJ3A6stUdmKz1KfLFbm2WDNG",
    owner: OWNER,
    agent: "3Hk5ZxpWQna8JDVCvjMvQw5HGMFdZGPRBzDf9eMGx3hZ",
    allowedPrograms: [
      "MrNEdFKsp4MSGPoQwnZqSxUYEbBYaxQGTdCSg1vmDVJ",
      "11111111111111111111111111111111",
    ],
    maxTxLamports: "10000000000",          // 10 SOL
    dailyBudgetLamports: "100000000000",   // 100 SOL
    sessionExpiry: "2026-05-01T00:00:00Z",
    isActive: true,
    squadsMultisig: null,
    escalationThreshold: null,
    anomalyScore: 3,
    label: "Staking Agent",
    createdAt: "2026-04-10T08:15:00Z",
    updatedAt: "2026-04-21T12:00:00Z",
  },
  {
    pubkey: "CsZ5LZkDS7h9TDKjt4zMJSiP8bZzYLkWsa4bGMQKDqeE",
    owner: OWNER,
    agent: "J2HH7qPsULG5CzzDmPLsEikMm1CCEZop5qmdDsCuQAA",
    allowedPrograms: [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      "11111111111111111111111111111111",
    ],
    maxTxLamports: "2000000000",           // 2 SOL
    dailyBudgetLamports: "20000000000",    // 20 SOL
    sessionExpiry: "2026-04-21T16:00:00Z",
    isActive: false,
    squadsMultisig: null,
    escalationThreshold: null,
    anomalyScore: 87,
    label: "Alpha Scanner",
    createdAt: "2026-04-15T10:00:00Z",
    updatedAt: "2026-04-21T15:02:03Z",
  },
  {
    pubkey: "F7nQ8rT5sU6vW7xY8zA9bC1dE2fG3hJ4kL5mN6pQ7rS",
    owner: OWNER,
    agent: "8TuV1wX2yZ3aB4cD5eF6gH7jK8lM9nP1qR2sT3uV4wX",
    allowedPrograms: [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      "MrNEdFKsp4MSGPoQwnZqSxUYEbBYaxQGTdCSg1vmDVJ",
      "11111111111111111111111111111111",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ],
    maxTxLamports: "50000000000",          // 50 SOL
    dailyBudgetLamports: "500000000000",   // 500 SOL
    sessionExpiry: "2026-06-01T00:00:00Z",
    isActive: true,
    squadsMultisig: "SMPLecH534Ngo6KPUV3GRbGN8D4BUXy4JUPq2YTJ1f",
    escalationThreshold: "25000000000",    // 25 SOL
    anomalyScore: 0,
    label: "Treasury Manager",
    createdAt: "2026-04-18T09:00:00Z",
    updatedAt: "2026-04-21T09:00:00Z",
  },
  {
    pubkey: "9GhJ1kL2mN3pQ4rS5tU6wV7xA8bC9dE1fG2hJ3kL4mN",
    owner: OWNER,
    agent: "5YzA1bC2dE3fG4hJ5kL6mN7pQ8rS9tU1wV2xA3bC4dE",
    allowedPrograms: [
      "11111111111111111111111111111111",
    ],
    maxTxLamports: "1000000000",           // 1 SOL
    dailyBudgetLamports: "5000000000",     // 5 SOL
    sessionExpiry: "2026-04-20T00:00:00Z", // already expired
    isActive: true,                        // active but session expired
    squadsMultisig: null,
    escalationThreshold: null,
    anomalyScore: 0,
    label: null,                           // no label set
    createdAt: "2026-04-19T10:00:00Z",
    updatedAt: "2026-04-19T10:00:00Z",
  },
];
