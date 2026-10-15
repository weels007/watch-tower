"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Gavel } from "lucide-react";
import type { Incident, Protocol } from "@/lib/genlayer";
import { CONTRACT_ADDRESS } from "@/lib/genlayer";
import { useWatchtowerContext } from "@/components/watchtower-provider";
import { ConsensusPanel } from "@/components/consensus-panel";
import { Badge, TxNote, btnGhost, cardCls, safeUrl, type Note, Spinner } from "@/components/ui-bits";
import { formatProviderError } from "@/lib/wallets";
import { formatGen } from "@/lib/format";

export default function IncidentDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const { client, write } = useWatchtowerContext();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [evalHash, setEvalHash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setMissing(false);
    try {
      const data = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_incident",
        args: [id],
      })) as Incident;
      setIncident(data);
      try {
        const proto = (await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_protocol",
          args: [data.protocol_id],
        })) as Protocol;
        setProtocol(proto);
      } catch {
        setProtocol(null);
      }
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  const evaluate = async () => {
    if (busy) return;
    setBusy(true);
    setEvalHash(null);
    setNote({ kind: "pending", text: "Evaluating — validators fetch evidence and vote. Takes minutes…", since: Date.now() });
    try {
      const { hash } = await write("evaluate_incident", [id]);
      setEvalHash(hash);
      setNote({ kind: "success", text: "Adjudicated. Verdict and votes below.", hash });
      await load();
    } catch (e) {
      setNote({ kind: "error", text: `Failed: ${formatProviderError(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[90rem] px-6 py-14 lg:px-10">
      <Link
        href="/incidents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All incidents
      </Link>

      {loading ? (
        <p className="py-12 text-sm text-muted-foreground">Reading incident #{id}…</p>
      ) : missing || !incident ? (
        <div className="py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Incident not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            No incident #{id} exists on the contract.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Incident #{id}
            </h1>
            <Badge value={incident.status} />
            <Badge value={incident.severity} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {incident.protocol_id}
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <article className={cardCls}>
                <h2 className="text-sm font-medium text-muted-foreground">Report</h2>
                <p className="mt-2 leading-relaxed">{incident.description || "—"}</p>
                {safeUrl(incident.evidence_url) ? (
                  <a
                    href={safeUrl(incident.evidence_url) as string}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    <span className="truncate">{incident.evidence_url}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                ) : (
                  <p className="mt-3 max-w-full truncate font-mono text-xs text-muted-foreground">
                    {incident.evidence_url}
                  </p>
                )}
              </article>

              <article className={cardCls}>
                <h2 className="text-sm font-medium text-muted-foreground">
                  Validator reasoning
                </h2>
                {incident.reasoning ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {incident.reasoning}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No verdict yet — this incident is still pending evaluation.
                  </p>
                )}
                {protocol && (
                  <div className="mt-4 border-t border-border pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground">
                      Judged against slash conditions
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {protocol.slash_conditions}
                    </p>
                  </div>
                )}
              </article>
            </div>

            <div className="space-y-4">
              <article className={cardCls}>
                <h2 className="text-sm font-medium text-muted-foreground">Verdict</h2>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd><Badge value={incident.status} /></dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Severity</dt>
                    <dd><Badge value={incident.severity} /></dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Confidence</dt>
                    <dd className="tabular-nums">{incident.confidence}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Payout</dt>
                    <dd className="tabular-nums">{formatGen(incident.payout_amount)} GEN</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Reporter</dt>
                    <dd className="truncate font-mono text-xs" title={incident.reporter}>
                      {incident.reporter.slice(0, 10)}…
                    </dd>
                  </div>
                </dl>
                {incident.status === "pending" && (
                  <button className={`${btnGhost} mt-4 w-full`} disabled={busy} onClick={evaluate}>
                    {busy ? <Spinner /> : <Gavel className="size-4" />}
                    {busy ? "Validators voting…" : "Trigger evaluation"}
                  </button>
                )}
                {incident.status === "confirmed_violation" && (
                  <Link
                    href="/claims"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
                  >
                    Claim payout →
                  </Link>
                )}
                <TxNote note={note} />
                <ConsensusPanel hash={evalHash} />
              </article>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
