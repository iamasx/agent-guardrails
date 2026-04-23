// Reporter stage — generates an Opus incident report asynchronously.
// Fire-and-forget: called without await from executor. Never blocks the pipeline.

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../db/client.js";
import { sseEmitter } from "../../sse/emitter.js";
import { env } from "../../config/env.js";
import {
  REPORT_SYSTEM,
  buildReportUserMessage,
} from "../prompts/incident-report.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Generate a full incident report using Claude Opus.
 * Updates the Incident row with the markdown report and emits report_ready SSE.
 * This function is called fire-and-forget — errors are logged but never propagated.
 */
export async function generateReport(
  incidentId: string,
  policyPubkey: string,
): Promise<void> {
  // Fetch last 24 hours of transactions with verdicts
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const history = await prisma.guardedTxn.findMany({
    where: {
      policyPubkey,
      createdAt: { gte: twentyFourHoursAgo },
    },
    include: { verdict: true },
    orderBy: { createdAt: "asc" },
  });

  // Fetch the incident with its judge verdict
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: { judgeVerdict: true },
  });

  if (!incident) {
    console.error(`[reporter] incident ${incidentId} not found`);
    return;
  }

  const userMessage = buildReportUserMessage(incident, history);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    system: REPORT_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const report = textBlock?.type === "text" ? textBlock.text : "";

  // Update incident with the full report
  await prisma.incident.update({
    where: { id: incidentId },
    data: { fullReport: report },
  });

  // Emit SSE event
  sseEmitter.emitEvent("report_ready", {
    incidentId,
    policyPubkey,
    fullReport: report,
  });

  console.log(
    `[reporter] generated report for incident ${incidentId} (${report.length} chars)`,
  );
}
