"use client";

import React, { type ComponentType, useMemo, useState, type ReactNode } from "react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { Adapter } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { ApiClientError, isUnauthorizedError } from "@/lib/api/client";
import { clearSiwsAndRedirectToSignin } from "@/lib/auth/siws-session";
import { useSSE } from "@/lib/sse/useSSE";

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

type SafeConnectionProviderProps = {
  children?: ReactNode;
  endpoint: string;
  config?: ConstructorParameters<typeof Connection>[1];
};

type SafeWalletProviderProps = {
  children?: ReactNode;
  wallets: Adapter[];
  autoConnect?: boolean | ((adapter: Adapter) => Promise<boolean>);
  localStorageKey?: string;
  onError?: (error: unknown, adapter?: Adapter) => void;
};

const SafeConnectionProvider = ConnectionProvider as unknown as ComponentType<SafeConnectionProviderProps>;
const SafeWalletProvider = WalletProvider as unknown as ComponentType<SafeWalletProviderProps>;

function RealtimeBridge(): null {
  useSSE();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (typeof window === "undefined") return;
            if (window.location.pathname === "/signin") return;
            if (isUnauthorizedError(error)) {
              clearSiwsAndRedirectToSignin();
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (error instanceof ApiClientError && error.status === 401) {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      }),
  );

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()],
    [],
  );

  return (
    <SafeConnectionProvider endpoint={RPC_ENDPOINT}>
      <SafeWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <RealtimeBridge />
            {children}
          </QueryClientProvider>
        </WalletModalProvider>
      </SafeWalletProvider>
    </SafeConnectionProvider>
  );
}

export function useAnchorProvider(): AnchorProvider | null {
  const wallet = useWallet();
  const { publicKey, signTransaction, signAllTransactions } = wallet;

  const provider = useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      return null;
    }

    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    return new AnchorProvider(connection, wallet as ConstructorParameters<typeof AnchorProvider>[1], {
      commitment: "confirmed",
    });
  }, [publicKey, signAllTransactions, signTransaction, wallet]);

  return provider;
}

export function getProgramId(): PublicKey | null {
  const value = process.env.NEXT_PUBLIC_GUARDRAILS_PROGRAM_ID;
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}
