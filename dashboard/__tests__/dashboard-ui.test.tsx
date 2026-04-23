import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppShell, PolicyCard, SpendGauge } from "@/components/dashboard-ui";
import { POLICIES } from "@/lib/mock";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/agents",
}));

vi.mock("@/components/wallet-controls", () => ({
  WalletControls: () => createElement("div", undefined, "Wallet controls"),
}));

describe("dashboard-ui", () => {
  it("renders shared shell chrome", () => {
    render(
      createElement(
        AppShell as any,
        { title: "Guardrails overview", subtitle: "Subcopy" },
        createElement("div", undefined, "Body content"),
      ),
    );

    expect(screen.getByText("Guardrails")).toBeInTheDocument();
    expect(screen.getByText("Guardrails overview")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByText("Wallet controls")).toBeInTheDocument();
  });

  it("renders policy card details", () => {
    render(createElement(PolicyCard, { policy: POLICIES[0] }));

    expect(screen.getByText(POLICIES[0].label as string)).toBeInTheDocument();
    expect(screen.getByText(/Daily budget/i)).toBeInTheDocument();
  });

  it("shows no-budget fallback in spend gauge", () => {
    render(createElement(SpendGauge, { spentLamports: "1000000000", budgetLamports: "0" }));
    expect(screen.getByText("No budget set.")).toBeInTheDocument();
  });

  it("shows over-budget state in spend gauge", () => {
    render(createElement(SpendGauge, { spentLamports: "2000000000", budgetLamports: "1000000000" }));
    expect(screen.getByText("OVER BUDGET")).toBeInTheDocument();
    expect(screen.getByText("2.0 / 1.0 SOL")).toBeInTheDocument();
  });
});
