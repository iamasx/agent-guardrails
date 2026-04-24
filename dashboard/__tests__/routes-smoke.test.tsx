import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INCIDENTS, POLICIES, TRANSACTIONS, VERDICTS } from "@/lib/mock";

const useQueryMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    publicKey: { toBase58: () => "Wallet1111111111111111111111111111111111" },
    signMessage: vi.fn(async () => new Uint8Array([1, 2, 3])),
  }),
}));

vi.mock("@/components/dashboard-ui", () => ({
  AppShell: ({ title, children }: { title: string; children: ReactNode }) =>
    createElement("section", undefined, createElement("h1", undefined, title), children),
  PolicyCard: ({ policy }: { policy: { pubkey: string } }) => createElement("div", undefined, policy.pubkey),
  TransactionRow: ({ transaction }: { transaction: { id: string } }) => createElement("div", undefined, transaction.id),
  IncidentTable: ({ incidents }: { incidents: unknown[] }) =>
    createElement("div", undefined, `incidents:${incidents.length}`),
  IncidentTimeline: ({ items }: { items: unknown[] }) => createElement("div", undefined, `timeline:${items.length}`),
  SimpleMarkdown: ({ markdown }: { markdown: string }) => createElement("div", undefined, markdown),
  SpendGauge: () => createElement("div", undefined, "gauge"),
  Metric: ({ label, value }: { label: string; value: ReactNode }) =>
    createElement("div", undefined, `${label}:${String(value)}`),
  StatusChip: ({ children }: { children: ReactNode }) => createElement("span", undefined, children),
}));

vi.mock("@/lib/stores/activity", () => ({
  useActivityStore: () => ({
    selectedPolicyPubkey: null,
    verdictFilter: "all",
    setSelectedPolicy: vi.fn(),
    setVerdictFilter: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/activity-filters", () => ({
  useActivityFiltersStore: () => ({
    selectedPolicyPubkey: null,
    verdictFilter: "all",
    setSelectedPolicy: vi.fn(),
    setVerdictFilter: vi.fn(),
    resetFilters: vi.fn(),
  }),
}));

beforeEach(() => {
  useQueryMock.mockReset();
  useQueryMock.mockReturnValue({ data: undefined, isLoading: false });
  pushMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("phase 1 route smoke tests", () => {
  it("renders landing and agents routes", async () => {
    const Home = (await import("@/app/page")).default;
    useQueryMock
      .mockReturnValueOnce({ data: POLICIES })
      .mockReturnValueOnce({ data: { items: TRANSACTIONS } })
      .mockReturnValueOnce({ data: { items: INCIDENTS } });
    render(createElement(Home));
    expect(screen.getByText("Agent Guardrails Protocol")).toBeTruthy();
    cleanup();

    const AgentsPage = (await import("@/app/agents/page")).default;
    useQueryMock.mockReturnValueOnce({ data: POLICIES });
    render(createElement(AgentsPage));
    expect(screen.getByRole("heading", { name: "Agents" })).toBeTruthy();
  });

  it("renders new, activity, and incidents routes", async () => {
    const NewAgentPage = (await import("@/app/agents/new/page")).default;
    render(createElement(NewAgentPage));
    expect(screen.getByText("Create Policy")).toBeTruthy();
    cleanup();

    const ActivityPage = (await import("@/app/activity/page")).default;
    useQueryMock
      .mockReturnValueOnce({ data: POLICIES })
      .mockReturnValueOnce({ data: { items: TRANSACTIONS.map((item, idx) => ({ ...item, verdict: VERDICTS[idx] ?? null })) } });
    render(createElement(ActivityPage));
    expect(screen.getByRole("heading", { name: "Activity" })).toBeTruthy();
    cleanup();

    const IncidentsPage = (await import("@/app/incidents/page")).default;
    useQueryMock.mockReturnValueOnce({ data: { items: INCIDENTS } });
    render(createElement(IncidentsPage));
    expect(screen.getByRole("heading", { name: "Incidents" })).toBeTruthy();
  });

  it("renders signin, agent detail, policy edit, and incident detail routes", async () => {
    const SignInPage = (await import("@/app/(auth)/signin/page")).default;
    render(createElement(SignInPage));
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeTruthy();
    cleanup();

    const AgentDetailPage = (await import("@/app/agents/[pubkey]/page")).default;
    useQueryMock
      .mockReturnValueOnce({ data: POLICIES[0] })
      .mockReturnValueOnce({ data: { items: TRANSACTIONS } })
      .mockReturnValueOnce({ data: { items: INCIDENTS } });
    render(createElement(AgentDetailPage, { params: { pubkey: POLICIES[0].pubkey } }));
    expect(screen.getByRole("heading", { name: POLICIES[0].label as string })).toBeTruthy();
    cleanup();

    const EditPolicyPage = (await import("@/app/agents/[pubkey]/policy/page")).default;
    useQueryMock.mockReturnValueOnce({ data: POLICIES });
    render(createElement(EditPolicyPage, { params: { pubkey: POLICIES[0].pubkey } }));
    expect(screen.getByText("Edit Policy")).toBeTruthy();
    cleanup();

    const IncidentDetailPage = (await import("@/app/incidents/[id]/page")).default;
    useQueryMock.mockReturnValue({
      data: {
        ...INCIDENTS[0],
        policy: { pubkey: POLICIES[0].pubkey, label: POLICIES[0].label, isActive: POLICIES[0].isActive },
        judgeVerdict: null,
      },
      isLoading: false,
    });
    render(createElement(IncidentDetailPage, { params: { id: INCIDENTS[0].id } }));
    expect(screen.getByRole("heading", { name: "Incident Detail" })).toBeTruthy();
  });
});
