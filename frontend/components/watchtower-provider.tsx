"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWatchtower } from "@/lib/genlayer";

type WatchtowerContextValue = ReturnType<typeof useWatchtower>;

const WatchtowerContext = createContext<WatchtowerContextValue | null>(null);

export function WatchtowerProvider({ children }: { children: ReactNode }) {
  const value = useWatchtower();
  return <WatchtowerContext.Provider value={value}>{children}</WatchtowerContext.Provider>;
}

export function useWatchtowerContext(): WatchtowerContextValue {
  const ctx = useContext(WatchtowerContext);
  if (!ctx) throw new Error("useWatchtowerContext must be used inside WatchtowerProvider");
  return ctx;
}
