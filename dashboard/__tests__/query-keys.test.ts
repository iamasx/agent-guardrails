import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";

describe("query keys", () => {
  it("builds canonical dashboard query keys", () => {
    expect(queryKeys.policies()).toEqual(["policies"]);
    expect(queryKeys.policy("abc")).toEqual(["policy", "abc"]);
    expect(queryKeys.transactions()).toEqual(["transactions"]);
    expect(queryKeys.transactionsByPolicy("policy-1")).toEqual(["transactions", "policy-1"]);
    expect(queryKeys.incidents()).toEqual(["incidents"]);
    expect(queryKeys.incidentsByPolicy("policy-1")).toEqual(["incidents", "policy-1"]);
    expect(queryKeys.incident("incident-1")).toEqual(["incident", "incident-1"]);
  });

  it("keeps backward compatible alias for policy key", () => {
    expect(queryKeys.policyByPubkey("abc")).toEqual(queryKeys.policy("abc"));
  });
});
