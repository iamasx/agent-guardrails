export const queryKeys = {
  policies: () => ["policies"] as const,
  policyByPubkey: (pubkey: string) => ["policy", pubkey] as const,
  transactions: () => ["transactions"] as const,
  transactionsByPolicy: (policyPubkey: string) => ["transactions", policyPubkey] as const,
  incidents: () => ["incidents"] as const,
  incidentsByPolicy: (policyPubkey: string) => ["incidents", policyPubkey] as const,
  incident: (incidentId: string) => ["incident", incidentId] as const,
};
