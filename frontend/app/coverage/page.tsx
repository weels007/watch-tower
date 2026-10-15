"use client";

import { Coverage } from "@/components/coverage";
import { PageShell } from "@/components/page-shell";
import { useWatchtowerContext } from "@/components/watchtower-provider";

export default function CoveragePage() {
  const { protocols, write } = useWatchtowerContext();
  return (
    <PageShell
      title="Get coverage"
      intro="Pay a premium into the shared pool and receive a policy. If validators confirm a violation on your protocol, the holder can claim up to the coverage amount."
    >
      <Coverage protocols={protocols} write={write} bare />
    </PageShell>
  );
}
