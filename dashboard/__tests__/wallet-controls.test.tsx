import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletControls } from "@/components/wallet-controls";
import { useSiwsAuthStore } from "@/lib/stores/siws-auth";

const walletState = {
  connected: false,
  publicKey: null as { toBase58: () => string } | null,
  wallet: null as unknown,
  connect: vi.fn(async () => {}),
};

const setVisibleMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => walletState,
}));

vi.mock("@solana/wallet-adapter-react-ui", () => ({
  useWalletModal: () => ({ setVisible: setVisibleMock }),
}));

describe("wallet controls SIWS states", () => {
  beforeEach(() => {
    localStorage.clear();
    useSiwsAuthStore.getState().clearSignedIn();
    walletState.connected = true;
    walletState.publicKey = { toBase58: () => "Wallet11111111111111111111111111111111" };
    walletState.wallet = {};
    walletState.connect.mockClear();
    setVisibleMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows sign-in CTA when wallet is connected but SIWS is missing", () => {
    render(createElement(WalletControls));
    expect(screen.getByText("Connect wallet + Sign in")).toBeInTheDocument();
  });

  it("shows signed-in badge when SIWS wallet matches connected wallet", () => {
    useSiwsAuthStore.getState().markSignedIn("Wallet11111111111111111111111111111111", "2026-01-01T00:00:00.000Z");
    render(createElement(WalletControls));
    expect(screen.getByText(/Signed in as/i)).toBeInTheDocument();
    expect(screen.queryByText("Connect wallet + Sign in")).toBeNull();
  });
});
