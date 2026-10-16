"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CONTRACT_ADDRESS, type Policy, type Protocol } from "@/lib/genlayer";
import { formatGen, formatTs } from "@/lib/format";
import { useWatchtowerContext } from "@/components/watchtower-provider";
import { Badge, cardCls } from "@/components/ui-bits";

export default function PolicyDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const { client, incidents } = useWatchtowerContext();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [protocol, setProtocol] = useState<{ id: string; data: Protocol } | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setMissing(false);
    try {
      const data = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_policy",
        args: [id],
      })) as Policy;
      setPolicy(data);
      try {
        const proto = (await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_protocol",
          args: [data.protocol_id],
        })) as Protocol;
        setProtocol({ id: data.protocol_id, data: proto });
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

  const related = incidents.filter((i) => policy && i.data.protocol_id === policy.protocol_id);
  const confirmed = related.filter((i) => i.data.status === "confirmed_violation");

  return (
    <div className="mx-auto w-full max-w-[90rem] px-6 py-14 lg:px-10">
      <Link
        href={policy ? `/protocols/${policy.protocol_id}` : "/protocols"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to protocol
      </Link>

      {loading ? (
        <p className="py-12 text-sm text-muted-foreground">Reading policy #{id}…</p>
      ) : missing || !policy ? (
        <div className="py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Policy not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            No policy #{id} exists on the contract.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Policy #{id}
            </h1>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                policy.active
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {policy.active ? "active" : "claimed"}
            </span>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <article className={cardCls}>
                <h2 className="text-sm font-medium text-muted-foreground">Terms</h2>
                <dl className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Premium paid</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatGen(policy.premium)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">GEN</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Coverage</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatGen(policy.coverage)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">GEN</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Holder</dt>
                    <dd className="mt-1 truncate font-mono text-sm" title={policy.holder}>
                      {policy.holder}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Protocol</dt>
                    <dd className="mt-1 text-sm">
                      <Link
                        href={`/protocols/${policy.protocol_id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {protocol?.data.name ?? policy.protocol_id}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Issued (must predate any claim)</dt>
                    <dd className="mt-1 font-mono text-sm">{formatTs(policy.created_at)} UTC</dd>
                  </div>
                </dl>
              </article>

              <article className={cardCls}>
                <h2 className="text-sm font-medium text-muted-foreground">
                  Incidents on this protocol ({related.length})
                </h2>
                {related.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No incidents reported yet. This policy pays out against confirmed
                    violations here.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {related.map(({ id: iid, data }) => (
                      <li key={iid}>
                        <Link
                          href={`/incidents/${iid}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted"
                        >
                          <span className="truncate">
                            <span className="font-mono text-xs text-muted-foreground">#{iid}</span>{" "}
                            {data.description || "—"}
                          </span>
                          <Badge value={data.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>

            <div className="space-y-4">
              <article className={cardCls}>
                <h2 className="text-sm font-medium text-muted-foreground">Claim</h2>
                {policy.active ? (
                  confirmed.length > 0 ? (
                    <>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {confirmed.length} confirmed violation{confirmed.length === 1 ? "" : "s"}{" "}
                        available to claim against.
                      </p>
                      <div className="mt-3 space-y-2">
                        {confirmed.map(({ id: iid }) => (
                          <Link
                            key={iid}
                            href={`/claims?policy=${id}&incident=${iid}`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
                          >
                            Claim against #{iid} <ArrowRight className="size-4" />
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      No confirmed violations on this protocol yet. Claims open once
                      validators confirm one.
                    </p>
                  )
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    This policy already paid out — each policy claims once.
                  </p>
                )}
              </article>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
