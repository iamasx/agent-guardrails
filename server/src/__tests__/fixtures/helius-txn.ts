import type { HeliusEnhancedTransaction } from "../../worker/routes/webhook.js";

export function makeHeliusTxn(overrides?: Partial<HeliusEnhancedTransaction>): HeliusEnhancedTransaction {
  return {
    signature: "test-sig-" + Math.random().toString(36).slice(2, 10),
    slot: 123456,
    timestamp: Math.floor(Date.now() / 1000),
    type: "TRANSFER",
    fee: 5000,
    feePayer: "AgentPubkey11111111111111111111111",
    nativeTransfers: [
      {
        fromUserAccount: "AgentPubkey11111111111111111111111",
        toUserAccount: "DestPubkey111111111111111111111111",
        amount: 100_000_000, // 0.1 SOL
      },
    ],
    tokenTransfers: [],
    instructions: [
      {
        programId: process.env.GUARDRAILS_PROGRAM_ID!,
        accounts: [
          "PolicyPda1111111111111111111111111",
          "AgentPubkey11111111111111111111111",
          "TargetProgram1111111111111111111111",
        ],
        data: "base64data",
        innerInstructions: [
          {
            programId: "TargetProgram1111111111111111111111",
            accounts: [],
            data: "innerdata",
          },
        ],
      },
    ],
    events: {},
    transactionError: null,
    accountData: [],
    ...overrides,
  };
}
