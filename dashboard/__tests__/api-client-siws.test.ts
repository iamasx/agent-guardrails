import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("SIWS API client (http mode)", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:9999";
    delete process.env.NEXT_PUBLIC_USE_MOCK_API;
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requestSiwsNonce posts pubkey with credentials include", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ nonce: "abc", message: "hello" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { requestSiwsNonce } = await import("@/lib/api/client");
    const result = await requestSiwsNonce("WalletPubkey11111111111111111111111");

    expect(result).toEqual({ nonce: "abc", message: "hello" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:9999/api/auth/siws/nonce");
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("POST");
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ pubkey: "WalletPubkey11111111111111111111111" });
  });

  it("verifySiwsSignature posts verify body with credentials include", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { verifySiwsSignature } = await import("@/lib/api/client");
    const result = await verifySiwsSignature({
      pubkey: "WalletPubkey11111111111111111111111",
      message: "Sign this…",
      signature: "c2ln",
    });

    expect(result).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({
      pubkey: "WalletPubkey11111111111111111111111",
      message: "Sign this…",
      signature: "c2ln",
    });
  });

  it("maps API error payload to ApiClientError on verify", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: "Invalid signature" })),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { verifySiwsSignature } = await import("@/lib/api/client");
    await expect(
      verifySiwsSignature({
        pubkey: "x",
        message: "m",
        signature: "sig",
      }),
    ).rejects.toMatchObject({ status: 401, message: "Invalid signature" });
  });
});
