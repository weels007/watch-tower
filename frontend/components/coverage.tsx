"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Protocol } from "@/lib/genlayer";
import { TxNote, btnPrimary, cardCls, inputCls, labelCls, type Note, Spinner } from "@/components/ui-bits";
import { formatProviderError } from "@/lib/wallets";
import { parseGen } from "@/lib/format";

export function Coverage({
  protocols,
  write,
  bare,
}: {
  protocols: { id: string; data: Protocol }[];
  write: (fn: string, args: unknown[], value?: bigint | number) => Promise<{ hash: string }>;
  bare?: boolean;
}) {
  const active = protocols.filter((p) => p.data.active);
  const [pid, setPid] = useState("");
  const [coverage, setCoverage] = useState("100");
  const [premium, setPremium] = useState("1");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!pid) return setNote({ kind: "error", text: "Pick a protocol first." });
    const coverageAmt = parseGen(coverage);
    const premiumAmt = parseGen(premium);
    if (coverageAmt === null || coverageAmt <= 0n)
      return setNote({ kind: "error", text: "Coverage must be a positive GEN amount (e.g. 100)." });
    if (premiumAmt === null || premiumAmt <= 0n)
      return setNote({ kind: "error", text: "Premium must be a positive GEN amount (e.g. 1)." });
    setBusy(true);
    setNote({ kind: "pending", text: "Submitting to validator consensus — about a minute…", since: Date.now() });
    try {
      const { hash } = await write("purchase_coverage", [pid, coverageAmt], premiumAmt);
      setNote({ kind: "success", text: "Coverage issued. Premium fed the pool.", hash });
    } catch (e) {
      setNote({ kind: "error", text: `Failed: ${formatProviderError(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const body = (
      <div className={`${cardCls} mt-6 max-w-xl`}>
        <label className={labelCls}>Protocol</label>
        <select
          className={inputCls}
          value={pid}
          onChange={(e) => setPid(e.target.value)}
        >
          <option value="">Select…</option>
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.data.name} ({p.id})
            </option>
          ))}
        </select>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Coverage amount (GEN)</label>
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="100"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Premium (GEN, sent with tx)</label>
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="1"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
            />
          </div>
        </div>
        <button className={`${btnPrimary} mt-4 w-full`} disabled={busy} onClick={submit}>
          {busy ? <Spinner /> : <ShieldCheck className="size-4" />}
          {busy ? "Waiting for consensus…" : "Buy policy"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          Premium is paid in GEN from the signing wallet. Out of test GEN? Top up
          with the{" "}
          <a
            href="https://studio.genlayer.com/"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Studio faucet (💧)
          </a>
          .
        </p>
        <TxNote note={note} />
      </div>
  );
  if (bare) return <>{body}</>;
  return (
    <section id="coverage" className="mx-auto w-full max-w-[90rem] scroll-mt-20 px-6 py-16 lg:px-10">
      <h2 className="text-2xl font-semibold tracking-tight">Get coverage</h2>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
        Pay a premium into the shared pool and receive a policy. If validators
        confirm a violation on your protocol, the holder can claim up to the
        coverage amount.
      </p>
      {body}
    </section>
  );
}
