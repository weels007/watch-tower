"use client";

import { ShieldCheck, Siren } from "lucide-react";
import { GridPulse } from "@/components/ui/grid-pulse";
import { formatGen } from "@/lib/format";

/** Halo in the page colour, so lit cells never crowd the letters. */
const guard =
  "[text-shadow:0_0_6px_var(--color-background),0_0_14px_var(--color-background),0_0_30px_var(--color-background),0_0_52px_var(--color-background)]";

export function Hero({
  pool,
  protocolCount,
  incidentCount,
}: {
  pool: string | null;
  protocolCount: number;
  incidentCount: number;
}) {
  return (
    <section className="relative flex min-h-[620px] w-full items-center overflow-hidden bg-background">
      <GridPulse cell={26} reach={2.8} ambient={3} />
      <div className="relative z-10 mx-auto w-full max-w-[90rem] px-6 py-20 lg:px-10">
        <p
          data-grid-avoid
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live on GenLayer studionet · LLM-adjudicated coverage
        </p>
        <h1
          data-grid-avoid
          className={`max-w-[14ch] text-[clamp(48px,8vw,104px)] font-semibold leading-[0.95] tracking-[-0.04em] text-foreground ${guard}`}
        >
          Watchtower never blinks.
        </h1>
        <p
          data-grid-avoid
          className={`mt-6 max-w-[52ch] text-[clamp(15px,1.5vw,19px)] leading-relaxed text-muted-foreground ${guard}`}
        >
          We monitor protocols for slashing violations, prove them with
          validator consensus over live web evidence, and pay insurance from
          the pool — no committee, no paperwork.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#coverage"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background"
          >
            <ShieldCheck className="size-4" /> Get coverage
          </a>
          <a
            href="#incidents"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/80 px-5 py-2.5 text-sm font-medium text-foreground backdrop-blur"
          >
            <Siren className="size-4" /> Report incident
          </a>
        </div>
        <dl className="mt-12 grid max-w-3xl grid-cols-3 gap-3">
          {[
            ["Pool balance", pool === null ? "…" : `${formatGen(pool)} GEN`],
            ["Protocols", String(protocolCount)],
            ["Incidents", String(incidentCount)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-background/80 px-4 py-3 backdrop-blur"
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
