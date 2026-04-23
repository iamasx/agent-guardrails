import { create } from "zustand";

type VerdictFilter = "all" | "allow" | "flag" | "pause";

interface ActivityStore {
  selectedPolicyPubkey: string | null;
  verdictFilter: VerdictFilter;
  setSelectedPolicy: (pubkey: string | null) => void;
  setVerdictFilter: (filter: VerdictFilter) => void;
}

export const useActivityStore = create<ActivityStore>((set) => ({
  selectedPolicyPubkey: null,
  verdictFilter: "all",
  setSelectedPolicy: (pubkey) => set({ selectedPolicyPubkey: pubkey }),
  setVerdictFilter: (filter) => set({ verdictFilter: filter }),
}));
