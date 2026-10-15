"use client";

import { Claims } from "@/components/claims";
import { PageShell } from "@/components/page-shell";
import { useWatchtowerContext } from "@/components/watchtower-provider";

export default function ClaimsPage() {
  const { activeAddress, external, write } = useWatchtowerContext();
  return (
    <PageShell
      title="Claims"
      intro="Policy holders claim against a confirmed violation, then withdraw. Connect a wallet to sign as its holder, or keep using the local burner identity."
    >
      <Claims address={activeAddress} walletName={external?.name ?? null} write={write} bare />
    </PageShell>
  );
}
