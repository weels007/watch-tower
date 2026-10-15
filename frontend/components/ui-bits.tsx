import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50";

export const cardCls = "rounded-xl border border-border bg-card p-5";

export const labelCls = "mb-1.5 block text-xs font-medium text-muted-foreground";

const tone: Record<string, string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  confirmed_violation: "border-red-400/30 bg-red-400/10 text-red-300",
  rejected: "border-border bg-muted text-muted-foreground",
  paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  none: "border-border bg-muted text-muted-foreground",
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  high: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  critical: "border-red-400/30 bg-red-400/10 text-red-300",
};

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${tone[value] ?? tone.none}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export type Note = {
  kind: "pending" | "success" | "error" | "info";
  text: string;
  hash?: string;
  /** Epoch ms when a pending operation started — renders a live elapsed timer. */
  since?: number;
};

const noteTone: Record<Note["kind"], string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  error: "border-red-400/30 bg-red-400/10 text-red-200",
  info: "border-border bg-muted/50 text-muted-foreground",
};

export function TxNote({ note }: { note: Note | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (note?.kind !== "pending" || !note.since) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, [note]);
  if (!note) return null;
  const elapsed =
    note.kind === "pending" && note.since
      ? ` · ${Math.max(0, Math.round((Date.now() - note.since) / 1000))}s elapsed`
      : "";
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${noteTone[note.kind]}`}>
      <p className="flex items-center gap-2">
        {note.kind === "pending" && <Spinner className="size-3.5" />}
        <span>{note.text}{elapsed}</span>
      </p>
      {note.hash && (
        <p className="mt-1 break-all font-mono opacity-80">
          tx{" "}
          <a
            href={`https://explorer-studio.genlayer.com/tx/${note.hash}`}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:underline"
            title={note.hash}
          >
            {note.hash.slice(0, 18)}…{note.hash.slice(-8)}
          </a>
        </p>
      )}
    </div>
  );
}

/** Legacy string-only note kept for compatibility. */
export function TxText({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mt-3 break-all rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      {text}
    </p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className ?? "size-4")} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-muted", className ?? "h-24")} />;
}

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function RefreshBar({
  updatedAt,
  refreshing,
  syncPhase,
  onRefresh,
}: {
  updatedAt: number | null;
  refreshing: boolean;
  syncPhase: string | null;
  onRefresh: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 10000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
      <span>
        {updatedAt ? `Updated ${ago(updatedAt, Date.now())}` : "Live data"}
        {refreshing ? ` · syncing ${syncPhase ?? "…"}…` : ""}
      </span>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-50"
      >
        {refreshing ? <Spinner className="size-3" /> : null}
        Refresh
      </button>
    </div>
  );
}

/** Only http(s) URLs are clickable. Anything else renders as plain text. */
export function safeUrl(url: string): string | null {
  return /^https?:\/\//i.test(url.trim()) ? url : null;
}

/** Only data:image icons from wallets are rendered. */
export function safeIcon(icon: string): string | null {
  return icon.startsWith("data:image/") ? icon : null;
}
