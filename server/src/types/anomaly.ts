// Verdict and anomaly types for the Claude judge pipeline.
// Shapes defined in docs/data-contracts.md section 4 (Server <-> Claude API Contract).

/**
 * Context object passed to the judge prompt builder.
 * Assembled by the worker pipeline from DB queries before calling Claude Haiku.
 */
export interface JudgeContext {
  policy: {
    agent: string;
    allowedPrograms: string[];
    maxTxSol: number;
    dailyBudgetSol: number;
    dailyUsedPct: number;
    minsToExpiry: number;
  };
  txn: {
    program: string;
    programLabel?: string;
    amountSol: number;
    pctOfCap: number;
    timestamp: string;
  };
  history: Array<{
    program: string;
    amountSol: number;
    status: string;
    minsAgo: number;
  }>;
  baseline: {
    medianAmount: number;
    p95Amount: number;
    activeHours: string;
    uniqueProgramsCount: number;
  };
  prefilterSignals: string[];
}

/**
 * Structured JSON output from the Claude Haiku judge.
 * Parsed from the model response after stripping code fences.
 */
export interface Verdict {
  verdict: "allow" | "flag" | "pause";
  confidence: number;
  reasoning: string;
  signals: string[];
}
