import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SiwsAuthState {
  siwsWallet: string | null;
  siwsSignedInAt: string | null;
  markSignedIn: (walletPubkey: string, signedInAt?: string) => void;
  clearSignedIn: () => void;
}

const initialState = {
  siwsWallet: null,
  siwsSignedInAt: null,
};

export const useSiwsAuthStore = create<SiwsAuthState>()(
  persist(
    (set) => ({
      ...initialState,
      markSignedIn: (walletPubkey, signedInAt = new Date().toISOString()) =>
        set({
          siwsWallet: walletPubkey,
          siwsSignedInAt: signedInAt,
        }),
      clearSignedIn: () => set(initialState),
    }),
    {
      name: "guardrails-siws-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        siwsWallet: state.siwsWallet,
        siwsSignedInAt: state.siwsSignedInAt,
      }),
    },
  ),
);
