"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTransactions } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useTransactionsQuery(policyPubkey?: string, limit = 50) {
  return useQuery({
    queryKey: policyPubkey ? queryKeys.transactionsByPolicy(policyPubkey) : queryKeys.transactions(),
    queryFn: () => fetchTransactions(policyPubkey, undefined, limit),
  });
}
