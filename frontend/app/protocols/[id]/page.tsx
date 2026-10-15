"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Satellite } from "lucide-react";
import { CONTRACT_ADDRESS, type Policy, type Protocol } from "@/lib/genlayer";
import { formatGen } from "@/lib/format";
import { useWatchtowerContext } from "@/components/watchtower-provider";
import { ActivePill } from "@/components/protocols";
import { cardCls } from "@/components/ui-bits";

export default function ProtocolDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const { client } = useWatchtowerContext();
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [policies, setPolicies] = useState<{ id: string; data: Policy }[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setMissing(false);
    try {
      const data = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_protocol",
        args: [id],
      })) as Protocol;
      setProtocol(data);
      const policyIds = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "list_policies",
        args: [],
      })) as string[];
      const all = await Promise.all(
        policyIds.map(async (pid) => ({
          id: pid,
          data: (await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_policy",
            args: [pid],
          })) as Policy,
        })),
      );
      setPolicies(all.filter((p) => p.data.protocol_id === id).reverse());
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[90rem] px-6 py-14 lg:px-10">
      <Link
        href="/protocols"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All protocols
      </Link>

      {loading ? (
        <p className="py-12 text-sm text-muted-foreground">Reading protocol {id}…</p>
      ) : missing || !protocol ? (
        <div className="py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Protocol not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            No protocol {id} exists on the contract.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Satellite className="size-6 text-muted-foreground" />
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {protocol.name}
            </h1>
            <ActivePill active={protocol.active} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{id}</p>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <article className={cardCls}>
                <h2 className="text-sm font-medium text-muted-foreground">
                  Slash conditions
                </h2>
                <p className="mt-2 text-sm leading-relaxed">{protocol.slash_conditions}</p>
                <dl className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Monitor endpoint</dt>
                    <dd className="break-all font-mono">{protocol.monitor_endpoint}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Evidence sources</dt>
                    <dd>{protocol.evidence_source}</dd>
                  </div>
                </dl>
              </article>

              <article className={cardCls}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Policies ({policies.length})
                  </h2>
                  <Link
                    href="/coverage"
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Buy coverage →
                  </Link>
                </div>
                {policies.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No policies issued for this protocol yet.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">ID</th>
                          <th className="py-2 pr-4 font-medium">Holder</th>
                          <th className="py-2 pr-4 text-right font-medium">Premium</th>
                          <th className="py-2 pr-4 text-right font-medium">Coverage</th>
                          <th className="py-2 text-right font-medium">State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map(({ id: pid, data }) => (
                          <tr key={pid} className="border-b border-border/50 last:border-0">
                            <td className="py-2.5 pr-4 font-mono text-xs">#{pid}</td>
                            <td className="py-2.5 pr-4 font-mono text-xs" title={data.holder}>
                              {data.holder.slice(0, 10)}…
                            </td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{formatGen(data.premium)}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{formatGen(data.coverage)}</td>
                            <td className="py-2.5 text-right">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                                  data.active
                                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                                    : "border-border bg-muted text-muted-foreground"
                                }`}
                              >
                                {data.active ? "active" : "claimed"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </div>

            <div className="space-y-4">
              <article className={cardCls}>
                <h2 className="text-sm font-medium text-muted-foreground">Coverage stats</h2>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Policies issued</dt>
                    <dd className="tabular-nums">{protocol.total_policies}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{protocol.active ? "Active" : "Inactive"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Active cover</dt>
                    <dd className="tabular-nums">
                      {formatGen(
                        policies
                          .filter((p) => p.data.active)
                          .reduce((sum, p) => sum + BigInt(p.data.coverage), 0n),
                      )}{" "}
                      GEN
                    </dd>
                  </div>
                </dl>
                <Link
                  href="/coverage"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  Insure this protocol →
                </Link>
              </article>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
