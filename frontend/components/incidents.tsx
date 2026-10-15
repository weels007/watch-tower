"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Gavel, Siren } from "lucide-react";
import type { Incident, Protocol } from "@/lib/genlayer";
import { Badge, TxNote, btnGhost, btnPrimary, cardCls, inputCls, labelCls, safeUrl, type Note, Spinner } from "@/components/ui-bits";
import { formatProviderError } from "@/lib/wallets";
import { formatGen } from "@/lib/format";
import { ConsensusPanel } from "@/components/consensus-panel";

export function Incidents({
  protocols,
  incidents,
  write,
  bare,
}: {
  protocols: { id: string; data: Protocol }[];
  incidents: { id: string; data: Incident }[];
  write: (fn: string, args: unknown[], value?: bigint | number) => Promise<{ hash: string }>;
  bare?: boolean;
}) {
  const [pid, setPid] = useState("");
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [lastEvalHash, setLastEvalHash] = useState<string | null>(null);

  const report = async () => {
    if (busy) return;
    if (!pid || !url.trim())
      return setNote({ kind: "error", text: "Protocol and evidence URL are required." });
    if (!safeUrl(url))
      return setNote({ kind: "error", text: "Evidence URL must start with http(s)://" });
    setBusy("report");
    setNote({ kind: "pending", text: "Reporting incident to the chain…", since: Date.now() });
    try {
      const { hash } = await write("report_incident", [pid, url.trim(), desc]);
      setNote({ kind: "success", text: "Incident reported as pending. Anyone can now trigger evaluation.", hash });
      setUrl("");
      setDesc("");
    } catch (e) {
      setNote({ kind: "error", text: `Failed: ${formatProviderError(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const evaluate = async (id: string) => {
    if (busy) return;
    setBusy(`eval-${id}`);
    setLastEvalHash(null);
    setNote({ kind: "pending", text: `Evaluating incident ${id} — validators fetch evidence and vote. Takes minutes…`, since: Date.now() });
    try {
      const { hash } = await write("evaluate_incident", [id]);
      setLastEvalHash(hash);
      setNote({ kind: "success", text: `Incident ${id} adjudicated. Verdict and votes below.`, hash });
    } catch (e) {
      setNote({ kind: "error", text: `Failed: ${formatProviderError(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const body = (
    <>
      <div className={`${cardCls} mt-6 max-w-xl`}>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Siren className="size-4" /> Report a violation
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls}>Protocol</label>
            <select className={inputCls} value={pid} onChange={(e) => setPid(e.target.value)}>
              <option value="">Select…</option>
              {protocols.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data.name} ({p.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Evidence URL</label>
            <input
              className={inputCls}
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={`${inputCls} min-h-20`}
              placeholder="What happened, in plain words"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <button className={`${btnPrimary} w-full`} disabled={busy !== null} onClick={report}>
            {busy === "report" ? <Spinner /> : null}
            {busy === "report" ? "Submitting…" : "Submit report"}
          </button>
        </div>
        <TxNote note={note} />
        <ConsensusPanel hash={lastEvalHash} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {incidents.map(({ id, data }) => (
          <article key={id} className={cardCls}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">#{id} · {data.protocol_id}</span>
              <Badge value={data.status} />
            </div>
            <p className="mt-2 text-sm">{data.description || "—"}</p>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{data.evidence_url}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge value={data.severity} />
              {data.confidence > 0 && (
                <span className="text-muted-foreground">confidence {data.confidence}</span>
              )}
              {String(data.payout_amount) !== "0" && (
                <span className="text-muted-foreground">paid {formatGen(data.payout_amount)} GEN</span>
              )}
            </div>
            {data.reasoning && (
              <p className="mt-3 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
                {data.reasoning}
              </p>
            )}
            {data.status === "pending" && (
              <button
                className={`${btnGhost} mt-4 w-full`}
                disabled={busy !== null}
                onClick={() => evaluate(id)}
              >
                {busy === `eval-${id}` ? <Spinner /> : <Gavel className="size-4" />}
                {busy === `eval-${id}` ? "Validators voting…" : "Trigger evaluation"}
              </button>
            )}
            <Link
              href={`/incidents/${id}`}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Details <ArrowRight className="size-4" />
            </Link>
          </article>
        ))}
        {incidents.length === 0 && (
          <p className="text-sm text-muted-foreground">No incidents yet.</p>
        )}
      </div>
    </>
  );
  if (bare) return <>{body}</>;
  return (
    <section id="incidents" className="mx-auto w-full max-w-[90rem] scroll-mt-20 px-6 py-16 lg:px-10">
      <h2 className="text-2xl font-semibold tracking-tight">Incidents</h2>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
        Anyone can report. Then anyone can trigger an evaluation: validators
        independently fetch the evidence, an LLM judges it against the slash
        conditions, and consensus settles the verdict.
      </p>
      {body}
    </section>
  );
}
