import { beforeEach, describe, expect, it } from "vitest";
import { useActivityFiltersStore } from "@/lib/stores/activity-filters";
import { useLayoutStore } from "@/lib/stores/layout";
import { useSiwsAuthStore } from "@/lib/stores/siws-auth";

describe("layout store", () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarOpen: true });
  });

  it("toggles sidebar visibility", () => {
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarOpen).toBe(false);
  });
});

describe("activity filters store", () => {
  beforeEach(() => {
    useActivityFiltersStore.getState().resetFilters();
  });

  it("updates and resets filters", () => {
    useActivityFiltersStore.getState().setSelectedPolicy("policy-1");
    useActivityFiltersStore.getState().setVerdictFilter("flag");

    expect(useActivityFiltersStore.getState().selectedPolicyPubkey).toBe("policy-1");
    expect(useActivityFiltersStore.getState().verdictFilter).toBe("flag");

    useActivityFiltersStore.getState().resetFilters();

    expect(useActivityFiltersStore.getState().selectedPolicyPubkey).toBeNull();
    expect(useActivityFiltersStore.getState().verdictFilter).toBe("all");
  });
});

describe("siws auth store", () => {
  beforeEach(() => {
    localStorage.clear();
    useSiwsAuthStore.getState().clearSignedIn();
  });

  it("marks and clears signed-in metadata", () => {
    useSiwsAuthStore.getState().markSignedIn("Wallet11111111111111111111111111111111", "2026-01-01T00:00:00.000Z");

    expect(useSiwsAuthStore.getState().siwsWallet).toBe("Wallet11111111111111111111111111111111");
    expect(useSiwsAuthStore.getState().siwsSignedInAt).toBe("2026-01-01T00:00:00.000Z");

    useSiwsAuthStore.getState().clearSignedIn();

    expect(useSiwsAuthStore.getState().siwsWallet).toBeNull();
    expect(useSiwsAuthStore.getState().siwsSignedInAt).toBeNull();
  });
});
