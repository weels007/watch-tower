"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Satellite } from "lucide-react";
import type { Protocol } from "@/lib/genlayer";
import { cardCls } from "@/components/ui-bits";

export function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
        active
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {active ? "active" : "inactive"}
    </span>
  );
}

export function Protocols({
  protocols,
  bare,
}: {
  protocols: { id: string; data: Protocol }[];
  bare?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const body = protocols.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No protocols registered yet — the owner registers them from the contract.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {protocols.map(({ id, data }) => (
            <article key={id} className={cardCls}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Satellite className="size-4 text-muted-foreground" />
                  <h3 className="font-medium">{data.name}</h3>
                </div>
                <ActivePill active={data.active} />
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{id}</p>
              <button
                className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => setOpen(open === id ? null : id)}
              >
                {open === id ? "Hide slash conditions" : "Show slash conditions"}
              </button>
              {open === id && (
                <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <p>
                    <span className="text-foreground">Monitor:</span> {data.monitor_endpoint}
                  </p>
                  <p>
                    <span className="text-foreground">Sources:</span> {data.evidence_source}
                  </p>
                  <p>
                    <span className="text-foreground">Conditions:</span> {data.slash_conditions}
                  </p>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {data.total_policies} {data.total_policies === 1 ? "policy" : "policies"} issued
              </p>
              <Link
                href={`/protocols/${id}`}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Details <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      );
  if (bare) return <>{body}</>;
  return (
    <section id="protocols" className="mx-auto w-full max-w-[90rem] scroll-mt-20 px-6 py-16 lg:px-10">
      <h2 className="text-2xl font-semibold tracking-tight">Monitored protocols</h2>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
        Each protocol declares its slash conditions on-chain. Validators judge
        every incident strictly against these words and live evidence.
      </p>
      {body}
    </section>
  );
}
