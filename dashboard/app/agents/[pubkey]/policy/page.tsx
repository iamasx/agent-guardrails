"use client";

import { AppShell } from "@/components/dashboard-ui";

export default function EditPolicyPage({ params }: { params: { pubkey: string } }) {
  return (
    <AppShell title="Edit policy" subtitle={`Policy ${params.pubkey}`}>
      <div className="card">Policy editing write path lands in Phase 4.</div>
    </AppShell>
  );
}
