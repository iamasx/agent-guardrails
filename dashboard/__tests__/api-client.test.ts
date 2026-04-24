import { describe, expect, it } from "vitest";
import {
  ApiClientError,
  apiMode,
  buildApiRequestInit,
  fetchIncident,
  fetchIncidents,
  fetchPolicies,
  fetchPolicy,
  fetchTransactions,
  getErrorMessage,
  isUnauthorizedError,
} from "@/lib/api/client";
import { INCIDENTS, POLICIES } from "@/lib/mock";

describe("api client mock data", () => {
  it("runs in mock mode during tests", () => {
    expect(apiMode).toBe("mock");
  });

  it("returns policies sorted by most recently updated", async () => {
    const policies = await fetchPolicies();
    expect(policies).toHaveLength(POLICIES.length);

    for (let index = 1; index < policies.length; index += 1) {
      const prev = new Date(policies[index - 1].updatedAt).getTime();
      const next = new Date(policies[index].updatedAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(next);
    }
  });

  it("returns single policy by pubkey", async () => {
    const policy = await fetchPolicy(POLICIES[0].pubkey);
    expect(policy.pubkey).toBe(POLICIES[0].pubkey);
  });

  it("filters and paginates transactions by policy key", async () => {
    const policyPubkey = POLICIES[0].pubkey;
    const firstPage = await fetchTransactions(policyPubkey, undefined, 2);
    expect(firstPage.items.length).toBeLessThanOrEqual(2);
    expect(firstPage.items.every((item: { policyPubkey: string }) => item.policyPubkey === policyPubkey)).toBe(true);

    if (firstPage.nextCursor) {
      const secondPage = await fetchTransactions(policyPubkey, firstPage.nextCursor, 2);
      if (secondPage.items[0]) {
        expect(secondPage.items[0].id).not.toEqual(firstPage.items[0]?.id);
      }
    }
  });

  it("falls back to default limits when invalid pagination limits are passed", async () => {
    const txns = await fetchTransactions(undefined, undefined, 0);
    expect(txns.items.length).toBeGreaterThan(0);

    const incidents = await fetchIncidents(undefined, undefined, -10);
    expect(incidents.items.length).toBeGreaterThan(0);
  });

  it("returns incident detail and rejects unknown incident ids", async () => {
    const incident = await fetchIncident(INCIDENTS[0].id);
    expect(incident.id).toBe(INCIDENTS[0].id);
    expect(incident.policy.pubkey).toBe(INCIDENTS[0].policyPubkey);
    expect(Array.isArray(incident.judgeVerdict?.signals ?? [])).toBe(true);

    await expect(fetchIncident("does-not-exist")).rejects.toThrow("Incident not found");
  });

  it("supports incident pagination", async () => {
    const firstPage = await fetchIncidents(undefined, undefined, 1);
    expect(firstPage.items).toHaveLength(1);
    if (firstPage.nextCursor) {
      const secondPage = await fetchIncidents(undefined, firstPage.nextCursor, 1);
      expect(secondPage.items[0]?.id).not.toEqual(firstPage.items[0].id);
    }
  });
});

describe("api client http mode behavior", () => {
  it("builds request init with cookie credentials and JSON Accept header", () => {
    const requestInit = buildApiRequestInit();
    expect(requestInit.credentials).toBe("include");
    expect(requestInit.headers).toBeInstanceOf(Headers);
    expect((requestInit.headers as Headers).get("Accept")).toBe("application/json");
  });

  it("merges Content-Type without dropping credentials include", () => {
    const requestInit = buildApiRequestInit({
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(requestInit.credentials).toBe("include");
    expect((requestInit.headers as Headers).get("Content-Type")).toBe("application/json");
    expect((requestInit.headers as Headers).get("Accept")).toBe("application/json");
  });

  it("normalizes ApiClientError message", () => {
    const err = new ApiClientError(401, "Unauthorized");
    expect(getErrorMessage(err)).toBe("Unauthorized");
  });

  it("isUnauthorizedError is true only for 401 ApiClientError", () => {
    expect(isUnauthorizedError(new ApiClientError(401, "nope"))).toBe(true);
    expect(isUnauthorizedError(new ApiClientError(403, "nope"))).toBe(false);
    expect(isUnauthorizedError(new Error("x"))).toBe(false);
  });
});

describe("error helper", () => {
  it("returns normalized messages from unknown error values", () => {
    expect(getErrorMessage("bad")).toContain("Something went wrong");
    expect(getErrorMessage(new Error("Known error"))).toBe("Known error");
  });
});
