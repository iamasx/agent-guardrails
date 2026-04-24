import { beforeEach, describe, expect, it } from "vitest";
import { useActivityFiltersStore } from "@/lib/stores/activity-filters";
import { useLayoutStore } from "@/lib/stores/layout";

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
