// Environment variable validation and export.
// Validates at import time — if any required var is missing, the process exits
// with a clear error message listing all missing variables.

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  PORT: parseInt(optional("PORT", "8080"), 10),
  SOLANA_RPC_URL: required("SOLANA_RPC_URL"),
  GUARDRAILS_PROGRAM_ID: required("GUARDRAILS_PROGRAM_ID"),
  MONITOR_KEYPAIR: required("MONITOR_KEYPAIR"),
  HELIUS_WEBHOOK_SECRET: required("HELIUS_WEBHOOK_SECRET"),
  ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),
  DATABASE_URL: required("DATABASE_URL"),
  DIRECT_URL: required("DIRECT_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  CORS_ORIGIN: optional("CORS_ORIGIN", "http://localhost:3000"),
} as const;
