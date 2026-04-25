import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiwsSignIn } from "@/components/auth/siws-sign-in";
import { useSiwsAuthStore } from "@/lib/stores/siws-auth";

const replaceMock = vi.fn();
const requestSiwsNonceMock = vi.fn();
const verifySiwsSignatureMock = vi.fn();
const signMessageMock = vi.fn(async () => new Uint8Array([1, 2, 3]));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    publicKey: { toBase58: () => "Wallet11111111111111111111111111111111" },
    signMessage: signMessageMock,
    connecting: false,
    connected: true,
  }),
}));

vi.mock("@/lib/api/client", () => ({
  ApiClientError: class extends Error {
    status: number;
    constructor(status = 500, message = "error") {
      super(message);
      this.status = status;
    }
  },
  getErrorMessage: () => "error",
  requestSiwsNonce: (...args: unknown[]) => requestSiwsNonceMock(...args),
  verifySiwsSignature: (...args: unknown[]) => verifySiwsSignatureMock(...args),
}));

describe("siws sign in flow", () => {
  beforeEach(() => {
    localStorage.clear();
    useSiwsAuthStore.getState().clearSignedIn();
    replaceMock.mockReset();
    requestSiwsNonceMock.mockReset();
    verifySiwsSignatureMock.mockReset();
    signMessageMock.mockClear();
  });

  it("stores signed-in metadata after successful SIWS verify", async () => {
    requestSiwsNonceMock.mockResolvedValue({
      nonce: "nonce-1",
      message: "Sign this message.\nNonce: nonce-1",
    });
    verifySiwsSignatureMock.mockResolvedValue({ ok: true });

    render(createElement(SiwsSignIn));
    fireEvent.click(screen.getByRole("button", { name: /sign in with solana/i }));

    await waitFor(() => {
      expect(verifySiwsSignatureMock).toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith("/agents");
      expect(useSiwsAuthStore.getState().siwsWallet).toBe("Wallet11111111111111111111111111111111");
      expect(useSiwsAuthStore.getState().siwsSignedInAt).toEqual(expect.any(String));
    });
  });
});
