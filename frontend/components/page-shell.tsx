"use client";

import type { ReactNode } from "react";
import { useWatchtowerContext } from "@/components/watchtower-provider";
import { RefreshBar, Skeleton } from "@/components/ui-bits";

export function PageShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const { loading, error, updatedAt, refreshing, syncPhase, refresh } = useWatchtowerContext();
  return (
    <div className="mx-auto w-full max-w-[90rem] px-6 py-14 lg:px-10">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
        {intro}
      </p>
      {!loading && (
        <RefreshBar updatedAt={updatedAt} refreshing={refreshing} syncPhase={syncPhase} onRefresh={() => void refresh()} />
      )}
      {error && <p className="mt-6 text-sm text-red-400">Couldn&apos;t reach the contract: {error}</p>}
      {loading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : (
        <div className="mt-8">{children}</div>
      )}
    </div>
  );
}
