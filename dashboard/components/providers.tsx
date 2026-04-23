"use client";

import React, { type ComponentType, useMemo, useState, type ReactNode } from "react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import type { Adapter } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
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
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <SafeConnectionProvider endpoint={RPC_ENDPOINT}>
      <SafeWalletProvider wallets={wallets} autoConnect>
        <QueryClientProvider client={queryClient}>
          <RealtimeBridge />
          {children}
        </QueryClientProvider>
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
