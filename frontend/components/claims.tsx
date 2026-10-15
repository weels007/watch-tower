"use client";

import { useState } from "react";
import { HandCoins, Wallet } from "lucide-react";
import { TxNote, btnGhost, btnPrimary, cardCls, inputCls, labelCls, type Note, Spinner } from "@/components/ui-bits";
import { formatProviderError } from "@/lib/wallets";

export function Claims({
  address,
  walletName,
  write,
  bare,
}: {
  address?: string;
  walletName: string | null;
  write: (fn: string, args: unknown[], value?: bigint | number) => Promise<{ hash: string }>;
  bare?: boolean;
}) {
  const [policyId, setPolicyId] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const run = async (key: string, fn: () => Promise<{ hash: string }>, done: string) => {
    if (busy) return;
    setBusy(key);
    setNote({ kind: "pending", text: "Submitting to validator consensus…", since: Date.now() });
    try {
      const { hash } = await fn();
      setNote({ kind: "success", text: done, hash });
    } catch (e) {
      setNote({ kind: "error", text: `Failed: ${formatProviderError(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const claim = () => {
    if (!policyId.trim() || !incidentId.trim()) {
      setNote({ kind: "error", text: "Policy ID and incident ID are required." });
      return;
    }
    return run("claim", () => write("payout_claim", [policyId.trim(), incidentId.trim()]).then((r) => r as { hash: string }), "Payout credited to your claimable balance.");
  };

  const body = (
    <>
      <p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
        Policy holders claim against a confirmed violation, then withdraw.{" "}
        {walletName ? (
          <>
            Signing as <span className="font-mono">{address?.slice(0, 10)}…</span> via{" "}
            {walletName}.
          </>
        ) : (
          <>
            No wallet connected — transactions use a local burner identity. Hit{" "}
            <span className="text-foreground">Connect wallet</span> up top to sign
            with MetaMask, Rabby, or any EIP-6963 wallet instead.
          </>
        )}
      </p>
      <div className="mt-6 grid max-w-4xl gap-4 md:grid-cols-2">
        <div className={cardCls}>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <HandCoins className="size-4" /> Claim payout
          </h3>
          <div className="mt-4 space-y-3">
            <div>
              <label className={labelCls}>Policy ID</label>
              <input className={inputCls} value={policyId} onChange={(e) => setPolicyId(e.target.value)} placeholder="1" />
            </div>
            <div>
              <label className={labelCls}>Confirmed incident ID</label>
              <input className={inputCls} value={incidentId} onChange={(e) => setIncidentId(e.target.value)} placeholder="1" />
            </div>
            <button
              className={`${btnPrimary} w-full`}
              disabled={busy !== null}
              onClick={() => void claim()}
            >
              {busy === "claim" ? <Spinner /> : null}
              {busy === "claim" ? "Waiting for consensus…" : "Claim"}
            </button>
          </div>
        </div>
        <div className={cardCls}>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="size-4" /> Withdraw
          </h3>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Moves your full claimable balance out. Fails cleanly when there is
            nothing to withdraw.
          </p>
          <button
            className={`${btnGhost} mt-4 w-full`}
            disabled={busy !== null}
            onClick={() => void run("withdraw", () => write("withdraw", []).then((r) => r as { hash: string }), "Withdrawn.")}
          >
            {busy === "withdraw" ? <Spinner /> : null}
            {busy === "withdraw" ? "Waiting for consensus…" : "Withdraw all"}
          </button>
        </div>
      </div>
      <TxNote note={note} />
    </>
  );
  if (bare) return <>{body}</>;
  return (
    <section id="claims" className="mx-auto w-full max-w-[90rem] scroll-mt-20 px-6 py-16 lg:px-10">
      <h2 className="text-2xl font-semibold tracking-tight">Claims</h2>
      <div className="mt-2">{body}</div>
    </section>
  );
}
