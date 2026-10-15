"use client";

import { Protocols } from "@/components/protocols";
import { PageShell } from "@/components/page-shell";
import { useWatchtowerContext } from "@/components/watchtower-provider";

export default function ProtocolsPage() {
  const { protocols } = useWatchtowerContext();
  return (
    <PageShell
      title="Monitored protocols"
      intro="Each protocol declares its slash conditions on-chain. Validators judge every incident strictly against these words and live evidence."
    >
      <Protocols protocols={protocols} bare />
    </PageShell>
  );
}
