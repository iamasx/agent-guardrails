import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("guardrails", () => {
  const svm = fromWorkspace(".");
  const provider = new LiteSVMProvider(svm);
  const program = new Program(
    require("../target/idl/guardrails.json"),
    provider
  );

  it("is initialized", async () => {
    // TODO: initialize_policy + verify PDA fields
  });

  // TODO: initialize_policy — creates both PDAs, verify field values
  // TODO: update_policy — modify limits, add/remove programs, change monitors
  // TODO: guarded_execute happy path — System Program SOL transfer succeeds
  // TODO: guarded_execute rejection — wrong program, over limit, expired session, paused
  // TODO: pause_agent — authorized monitor can pause, unauthorized cannot
  // TODO: resume_agent — only owner, not monitor
  // TODO: SpendTracker — partial spends, rollover at 24h, exceeding daily budget
  // TODO: escalate_to_squads — amount above threshold triggers proposal
});
