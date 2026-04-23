import { describe, expect, it } from "vitest";
import { effectiveVerdict } from "@/lib/utils";

describe("effectiveVerdict", () => {
  it("defaults missing verdicts to allow", () => {
    expect(effectiveVerdict(undefined)).toBe("allow");
    expect(effectiveVerdict(null)).toBe("allow");
  });

  it("preserves explicit verdict values", () => {
    expect(effectiveVerdict("allow")).toBe("allow");
    expect(effectiveVerdict("flag")).toBe("flag");
    expect(effectiveVerdict("pause")).toBe("pause");
  });
});
