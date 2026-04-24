import { create } from "zustand";

export type VerdictFilter = "all" | "allow" | "flag" | "pause";

interface ActivityFiltersStore {
  selectedPolicyPubkey: string | null;
  verdictFilter: VerdictFilter;
  setSelectedPolicy: (pubkey: string | null) => void;
  setVerdictFilter: (filter: VerdictFilter) => void;
  resetFilters: () => void;
}

const initialState = {
  selectedPolicyPubkey: null,
  verdictFilter: "all" as VerdictFilter,
};

export const useActivityFiltersStore = create<ActivityFiltersStore>((set) => ({
  ...initialState,
  setSelectedPolicy: (pubkey) => set({ selectedPolicyPubkey: pubkey }),
  setVerdictFilter: (filter) => set({ verdictFilter: filter }),
  resetFilters: () => set(initialState),
}));
