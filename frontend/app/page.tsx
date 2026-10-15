"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Skeleton } from "@/components/ui-bits";
import { useWatchtowerContext } from "@/components/watchtower-provider";

export default function Home() {
  const { pool, protocols, incidents, loading, error } = useWatchtowerContext();

  return (
    <div id="top">
      <Hero pool={pool} protocolCount={protocols.length} incidentCount={incidents.length} />
      {error && (
        <p className="mx-auto w-full max-w-[90rem] px-6 text-sm text-red-400 lg:px-10">
          Couldn&apos;t reach the contract: {error}
        </p>
      )}
      {loading && (
        <div className="mx-auto grid w-full max-w-[90rem] gap-4 px-6 py-10 md:grid-cols-3 lg:px-10">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
      <HowItWorks />
      <section className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Put the watchtower to work.
            </h2>
            <p className="mt-2 max-w-[52ch] text-sm text-muted-foreground">
              Insure a protocol, report what you see, trigger an adjudication,
              or claim what you&apos;re owed — all against the live contract.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/coverage"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background"
            >
              Get coverage <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/incidents"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium"
            >
              Open incidents
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
