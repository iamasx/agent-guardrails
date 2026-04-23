-- CreateTable
CREATE TABLE "policies" (
    "pubkey" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "allowed_programs" TEXT[],
    "max_tx_lamports" BIGINT NOT NULL,
    "daily_budget_lamports" BIGINT NOT NULL,
    "session_expiry" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "squads_multisig" TEXT,
    "escalation_threshold" BIGINT,
    "anomaly_score" SMALLINT NOT NULL DEFAULT 0,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("pubkey")
);

-- CreateTable
CREATE TABLE "guarded_txns" (
    "id" TEXT NOT NULL,
    "policy_pubkey" TEXT NOT NULL,
    "txn_sig" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "block_time" TIMESTAMP(3) NOT NULL,
    "target_program" TEXT NOT NULL,
    "amount_lamports" BIGINT,
    "status" TEXT NOT NULL,
    "reject_reason" TEXT,
    "raw_event" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guarded_txns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_verdicts" (
    "id" TEXT NOT NULL,
    "txn_id" TEXT NOT NULL,
    "policy_pubkey" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "confidence" SMALLINT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "prefilter_skipped" BOOLEAN NOT NULL DEFAULT false,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_verdicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "policy_pubkey" TEXT NOT NULL,
    "paused_at" TIMESTAMP(3) NOT NULL,
    "paused_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "triggering_txn_sig" TEXT,
    "judge_verdict_id" TEXT,
    "full_report" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "wallet_pubkey" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policies_owner_idx" ON "policies"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "guarded_txns_txn_sig_key" ON "guarded_txns"("txn_sig");

-- CreateIndex
CREATE INDEX "guarded_txns_policy_pubkey_block_time_idx" ON "guarded_txns"("policy_pubkey", "block_time" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "anomaly_verdicts_txn_id_key" ON "anomaly_verdicts"("txn_id");

-- CreateIndex
CREATE INDEX "anomaly_verdicts_policy_pubkey_created_at_idx" ON "anomaly_verdicts"("policy_pubkey", "created_at" DESC);

-- CreateIndex
CREATE INDEX "incidents_policy_pubkey_paused_at_idx" ON "incidents"("policy_pubkey", "paused_at" DESC);

-- AddForeignKey
ALTER TABLE "guarded_txns" ADD CONSTRAINT "guarded_txns_policy_pubkey_fkey" FOREIGN KEY ("policy_pubkey") REFERENCES "policies"("pubkey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_verdicts" ADD CONSTRAINT "anomaly_verdicts_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "guarded_txns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_policy_pubkey_fkey" FOREIGN KEY ("policy_pubkey") REFERENCES "policies"("pubkey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_judge_verdict_id_fkey" FOREIGN KEY ("judge_verdict_id") REFERENCES "anomaly_verdicts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
