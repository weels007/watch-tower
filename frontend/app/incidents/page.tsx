"use client";

import { Incidents } from "@/components/incidents";
import { PageShell } from "@/components/page-shell";
import { useWatchtowerContext } from "@/components/watchtower-provider";

export default function IncidentsPage() {
  const { protocols, incidents, write } = useWatchtowerContext();
  return (
    <PageShell
      title="Incidents"
      intro="Anyone can report. Then anyone can trigger an evaluation: validators independently fetch the evidence, an LLM judges it against the slash conditions, and consensus settles the verdict."
    >
      <Incidents protocols={protocols} incidents={incidents} write={write} bare />
    </PageShell>
  );
}
