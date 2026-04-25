// Reporter stage — generates an incident report asynchronously using the active LLM.
// Fire-and-forget: called without await from executor. Never blocks the pipeline.

import { prisma } from "../../db/client.js";
import { sseEmitter } from "../../sse/emitter.js";
import { llmCall } from "../../config/llm.js";
import {
  REPORT_SYSTEM,
  buildReportUserMessage,
} from "../prompts/incident-report.js";

/**
 * Generate a full incident report using the active LLM provider (report tier).
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

  const response = await llmCall({
    system: REPORT_SYSTEM,
    userMessage,
    maxTokens: 2048,
    tier: "report",
  });

  const report = response.text;

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
    `[reporter] generated report for incident ${incidentId} (${report.length} chars, model=${response.model})`,
  );
}
