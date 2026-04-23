import { describe, it, expect, vi, afterEach } from "vitest";

// All required env vars that env.ts validates via `required()`.
const REQUIRED_VARS = [
  "SOLANA_RPC_URL",
  "GUARDRAILS_PROGRAM_ID",
  "MONITOR_KEYPAIR",
  "HELIUS_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
] as const;

/** Build a process.env object with all required vars set to dummy values. */
function fullEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of REQUIRED_VARS) {
    env[key] = `test-${key}`;
  }
  return env;
}

let savedEnv: NodeJS.ProcessEnv;

afterEach(() => {
  // Restore process.env after every test to avoid cross-contamination.
  process.env = savedEnv;
});

describe("config/env", () => {
  // -----------------------------------------------------------------------
  // required vars
  // -----------------------------------------------------------------------
  describe("required vars", () => {
    it("throws with clear message when a required var is missing", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      // Set all vars except ANTHROPIC_API_KEY
      const partial = fullEnv();
      delete partial.ANTHROPIC_API_KEY;
      process.env = { ...partial };

      await expect(import("./env.js")).rejects.toThrow(
        "Missing required env var: ANTHROPIC_API_KEY",
      );
    });

    it("throws when the env var is an empty string", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      const env = fullEnv();
      env.JWT_SECRET = "";
      process.env = { ...env };

      await expect(import("./env.js")).rejects.toThrow(
        "Missing required env var: JWT_SECRET",
      );
    });

    it("returns the value when set", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      const env = fullEnv();
      env.SOLANA_RPC_URL = "https://api.devnet.solana.com";
      process.env = { ...env };

      const { env: config } = await import("./env.js");
      expect(config.SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
    });
  });

  // -----------------------------------------------------------------------
  // port validation
  // -----------------------------------------------------------------------
  describe("port validation", () => {
    it("uses fallback 8080 when PORT is not set", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      process.env = { ...fullEnv() };
      // PORT intentionally not set

      const { env: config } = await import("./env.js");
      expect(config.PORT).toBe(8080);
    });

    it("parses valid port string", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      process.env = { ...fullEnv(), PORT: "3000" };

      const { env: config } = await import("./env.js");
      expect(config.PORT).toBe(3000);
    });

    it("throws for non-numeric string like 'abc'", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      process.env = { ...fullEnv(), PORT: "abc" };

      await expect(import("./env.js")).rejects.toThrow(
        /Invalid env var PORT.*abc/,
      );
    });

    it("throws for port 0", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      process.env = { ...fullEnv(), PORT: "0" };

      await expect(import("./env.js")).rejects.toThrow(
        /Invalid env var PORT.*0/,
      );
    });

    it("throws for negative port", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      process.env = { ...fullEnv(), PORT: "-1" };

      await expect(import("./env.js")).rejects.toThrow(
        /Invalid env var PORT.*-1/,
      );
    });

    it("throws for port > 65535", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      process.env = { ...fullEnv(), PORT: "70000" };

      await expect(import("./env.js")).rejects.toThrow(
        /Invalid env var PORT.*70000/,
      );
    });
  });

  // -----------------------------------------------------------------------
  // env object
  // -----------------------------------------------------------------------
  describe("env object", () => {
    it("exports all required fields when fully configured", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      process.env = { ...fullEnv(), PORT: "4000", CORS_ORIGIN: "https://app.example.com" };

      const { env: config } = await import("./env.js");

      expect(config.PORT).toBe(4000);
      expect(config.CORS_ORIGIN).toBe("https://app.example.com");

      for (const key of REQUIRED_VARS) {
        expect(config[key]).toBeDefined();
        expect(typeof config[key]).toBe("string");
      }
    });

    it("uses fallback for CORS_ORIGIN when not set", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      process.env = { ...fullEnv() };
      // CORS_ORIGIN intentionally not set

      const { env: config } = await import("./env.js");
      expect(config.CORS_ORIGIN).toBe("http://localhost:3000");
    });

    it("throws at import when any required var is missing", async () => {
      savedEnv = { ...process.env };
      vi.resetModules();

      // Set almost nothing — first required var will fail
      process.env = { PORT: "8080" };

      await expect(import("./env.js")).rejects.toThrow(
        /Missing required env var/,
      );
    });
  });
});
