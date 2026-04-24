"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPolicy } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function usePolicyQuery(pubkey: string) {
  return useQuery({
    queryKey: queryKeys.policy(pubkey),
    queryFn: () => fetchPolicy(pubkey),
    enabled: Boolean(pubkey),
  });
}
