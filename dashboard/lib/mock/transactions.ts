/**
 * Mock guarded_txns — mirrors `guarded_txns` table (server/prisma/schema.prisma)
 *
 * Narrative:
 * - Yield Bot: 8 normal Jupiter swaps over the day
 * - Staking Agent: 4 normal Marinade operations
 * - Alpha Scanner: 3 normal, then 5 burst txns (last triggers pause)
 */

export interface GuardedTxn {
  id: string;
  policy_pubkey: string;
  txn_sig: string;
  slot: number;
  block_time: string; // ISO 8601
  target_program: string;
  amount_lamports: number | null;
  status: "executed" | "rejected" | "escalated";
  reject_reason: string | null;
  raw_event: Record<string, unknown>;
  created_at: string;
}

// Policy pubkeys from policies.ts
const YIELD_BOT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const STAKING_AGENT = "8dHEsGNtQ2obTBbh8mxmXJ3A6stUdmKz1KfLFbm2WDNG";
const ALPHA_SCANNER = "CsZ5LZkDS7h9TDKjt4zMJSiP8bZzYLkWsa4bGMQKDqeE";

const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const MARINADE = "MrNEdFKsp4MSGPoQwnZqSxUYEbBYaxQGTdCSg1vmDVJ";
const SYSTEM = "11111111111111111111111111111111";
const UNKNOWN_PROGRAM = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

export const TRANSACTIONS: GuardedTxn[] = [
  // === Yield Bot — normal Jupiter swaps ===
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    policy_pubkey: YIELD_BOT,
    txn_sig: "5UfDuX8qXn3bP6vR2c4d8wKL2NhU9tCmfvA7z3Qx1YjEFbGn8WkT4RpJ6sN7mV5aH3qL9wX2cF8bD4kM1nP3rS",
    slot: 285_000_100,
    block_time: "2026-04-21T09:00:12Z",
    target_program: JUPITER,
    amount_lamports: 1_500_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T09:00:13Z",
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000002",
    policy_pubkey: YIELD_BOT,
    txn_sig: "3KmPqW9vR4sT7bN2cF5dA8xL6jH1gE4kM3nQ7wY9zU2rV5tX8aJ6pD4sB1fC3hG7mK9qL2wN5xR8yT4vE6jA",
    slot: 285_000_450,
    block_time: "2026-04-21T09:15:30Z",
    target_program: JUPITER,
    amount_lamports: 800_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T09:15:31Z",
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000003",
    policy_pubkey: YIELD_BOT,
    txn_sig: "2NfGhJ7kL8mP9qR3sT4vW5xY6zA1bC2dE3fH4jK5nQ6rS7tU8wV9xA1bC2dE3fG4hJ5kL6mN7pQ8rS9tU",
    slot: 285_001_200,
    block_time: "2026-04-21T10:30:45Z",
    target_program: JUPITER,
    amount_lamports: 2_200_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T10:30:46Z",
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000004",
    policy_pubkey: YIELD_BOT,
    txn_sig: "4PqR5sT6vW7xY8zA9bC1dE2fG3hJ4kL5mN6pQ7rS8tU9wV1xA2bC3dE4fG5hJ6kL7mN8pQ9rS1tU2wV3xA",
    slot: 285_002_000,
    block_time: "2026-04-21T11:45:00Z",
    target_program: JUPITER,
    amount_lamports: 3_100_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T11:45:01Z",
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000005",
    policy_pubkey: YIELD_BOT,
    txn_sig: "5RsT6vW7xY8zA9bC1dE2fG3hJ4kL5mN6pQ7rS8tU9wV1xA2bC3dE4fG5hJ6kL7mN8pQ9rS1tU2wV3xA4bC",
    slot: 285_002_800,
    block_time: "2026-04-21T12:30:20Z",
    target_program: JUPITER,
    amount_lamports: 950_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T12:30:21Z",
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000006",
    policy_pubkey: YIELD_BOT,
    txn_sig: "6TuV7wX8yZ9aB1cD2eF3gH4jK5lM6nP7qR8sT9uV1wX2yZ3aB4cD5eF6gH7jK8lM9nP1qR2sT3uV4wX5yZ",
    slot: 285_003_500,
    block_time: "2026-04-21T13:15:10Z",
    target_program: JUPITER,
    amount_lamports: 1_800_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T13:15:11Z",
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000007",
    policy_pubkey: YIELD_BOT,
    txn_sig: "7UvW8xY9zA1bC2dE3fG4hJ5kL6mN7pQ8rS9tU1wV2xA3bC4dE5fG6hJ7kL8mN9pQ1rS2tU3wV4xA5bC6dE",
    slot: 285_004_200,
    block_time: "2026-04-21T14:00:55Z",
    target_program: JUPITER,
    amount_lamports: 2_500_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T14:00:56Z",
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000008",
    policy_pubkey: YIELD_BOT,
    txn_sig: "8VwX9yZ1aB2cD3eF4gH5jK6lM7nP8qR9sT1uV2wX3yZ4aB5cD6eF7gH8jK9lM1nP2qR3sT4uV5wX6yZ7aB",
    slot: 285_005_000,
    block_time: "2026-04-21T14:45:30Z",
    target_program: SYSTEM,
    amount_lamports: 500_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T14:45:31Z",
  },

  // === Staking Agent — normal Marinade operations ===
  {
    id: "b2c3d4e5-0001-4000-8000-000000000001",
    policy_pubkey: STAKING_AGENT,
    txn_sig: "2AbC3dEf4gHj5kLm6nPq7rSt8uVw9xYz1AbC2dEf3gHj4kLm5nPq6rSt7uVw8xYz9AbC1dEf2gHj3kLm",
    slot: 285_000_200,
    block_time: "2026-04-21T09:05:00Z",
    target_program: MARINADE,
    amount_lamports: 5_000_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T09:05:01Z",
  },
  {
    id: "b2c3d4e5-0001-4000-8000-000000000002",
    policy_pubkey: STAKING_AGENT,
    txn_sig: "3BcD4eF5gH6jK7lM8nP9qR1sT2uV3wX4yZ5aB6cD7eF8gH9jK1lM2nP3qR4sT5uV6wX7yZ8aB9cD1eF",
    slot: 285_001_800,
    block_time: "2026-04-21T10:45:00Z",
    target_program: MARINADE,
    amount_lamports: 8_000_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T10:45:01Z",
  },
  {
    id: "b2c3d4e5-0001-4000-8000-000000000003",
    policy_pubkey: STAKING_AGENT,
    txn_sig: "4CdE5fG6hJ7kL8mN9pQ1rS2tU3wV4xA5bC6dE7fG8hJ9kL1mN2pQ3rS4tU5wV6xA7bC8dE9fG1hJ2kL",
    slot: 285_003_100,
    block_time: "2026-04-21T12:50:00Z",
    target_program: MARINADE,
    amount_lamports: 3_000_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T12:50:01Z",
  },
  {
    id: "b2c3d4e5-0001-4000-8000-000000000004",
    policy_pubkey: STAKING_AGENT,
    txn_sig: "5DeF6gH7jK8lM9nP1qR2sT3uV4wX5yZ6aB7cD8eF9gH1jK2lM3nP4qR5sT6uV7wX8yZ9aB1cD2eF3gH",
    slot: 285_004_500,
    block_time: "2026-04-21T14:20:00Z",
    target_program: MARINADE,
    amount_lamports: 6_500_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T14:20:01Z",
  },

  // === Alpha Scanner — normal, then burst, then paused ===
  {
    id: "c3d4e5f6-0001-4000-8000-000000000001",
    policy_pubkey: ALPHA_SCANNER,
    txn_sig: "6EfG7hJ8kL9mN1pQ2rS3tU4wV5xA6bC7dE8fG9hJ1kL2mN3pQ4rS5tU6wV7xA8bC9dE1fG2hJ3kL4mN",
    slot: 285_000_300,
    block_time: "2026-04-21T09:10:00Z",
    target_program: JUPITER,
    amount_lamports: 500_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T09:10:01Z",
  },
  {
    id: "c3d4e5f6-0001-4000-8000-000000000002",
    policy_pubkey: ALPHA_SCANNER,
    txn_sig: "7FgH8jK9lM1nP2qR3sT4uV5wX6yZ7aB8cD9eF1gH2jK3lM4nP5qR6sT7uV8wX9yZ1aB2cD3eF4gH5jK",
    slot: 285_002_500,
    block_time: "2026-04-21T12:00:00Z",
    target_program: JUPITER,
    amount_lamports: 800_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T12:00:01Z",
  },
  {
    id: "c3d4e5f6-0001-4000-8000-000000000003",
    policy_pubkey: ALPHA_SCANNER,
    txn_sig: "8GhJ9kL1mN2pQ3rS4tU5wV6xA7bC8dE9fG1hJ2kL3mN4pQ5rS6tU7wV8xA9bC1dE2fG3hJ4kL5mN6pQ",
    slot: 285_004_900,
    block_time: "2026-04-21T14:55:00Z",
    target_program: SYSTEM,
    amount_lamports: 400_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T14:55:01Z",
  },
  // --- Burst begins: 5 txns in 10 seconds ---
  {
    id: "c3d4e5f6-0001-4000-8000-000000000004",
    policy_pubkey: ALPHA_SCANNER,
    txn_sig: "9HjK1lM2nP3qR4sT5uV6wX7yZ8aB9cD1eF2gH3jK4lM5nP6qR7sT8uV9wX1yZ2aB3cD4eF5gH6jK7lM",
    slot: 285_005_100,
    block_time: "2026-04-21T15:00:00Z",
    target_program: UNKNOWN_PROGRAM, // not whitelisted!
    amount_lamports: 1_800_000_000,  // 90% of cap
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T15:00:01Z",
  },
  {
    id: "c3d4e5f6-0001-4000-8000-000000000005",
    policy_pubkey: ALPHA_SCANNER,
    txn_sig: "1JkL2mN3pQ4rS5tU6wV7xA8bC9dE1fG2hJ3kL4mN5pQ6rS7tU8wV9xA1bC2dE3fG4hJ5kL6mN7pQ8rS",
    slot: 285_005_102,
    block_time: "2026-04-21T15:00:02Z",
    target_program: UNKNOWN_PROGRAM,
    amount_lamports: 1_900_000_000,  // 95% of cap
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T15:00:03Z",
  },
  {
    id: "c3d4e5f6-0001-4000-8000-000000000006",
    policy_pubkey: ALPHA_SCANNER,
    txn_sig: "2KlM3nP4qR5sT6uV7wX8yZ9aB1cD2eF3gH4jK5lM6nP7qR8sT9uV1wX2yZ3aB4cD5eF6gH7jK8lM9nP",
    slot: 285_005_104,
    block_time: "2026-04-21T15:00:05Z",
    target_program: UNKNOWN_PROGRAM,
    amount_lamports: 1_950_000_000,
    status: "executed",
    reject_reason: null,
    raw_event: {},
    created_at: "2026-04-21T15:00:06Z",
  },
  {
    id: "c3d4e5f6-0001-4000-8000-000000000007",
    policy_pubkey: ALPHA_SCANNER,
    txn_sig: "3LmN4pQ5rS6tU7wV8xA9bC1dE2fG3hJ4kL5mN6pQ7rS8tU9wV1xA2bC3dE4fG5hJ6kL7mN8pQ9rS1tU",
    slot: 285_005_106,
    block_time: "2026-04-21T15:00:08Z",
    target_program: UNKNOWN_PROGRAM,
    amount_lamports: 2_000_000_000,  // at cap
    status: "rejected",
    reject_reason: "Agent paused by monitor",
    raw_event: {},
    created_at: "2026-04-21T15:00:09Z",
  },
];
