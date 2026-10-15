"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useWatchtowerContext } from "@/components/watchtower-provider";
import { Spinner, cardCls } from "@/components/ui-bits";

type ConsensusSummary = {
  statusName?: string;
  execution?: string;
  rounds?: string;
  agree: number;
  disagree: number;
  other: number;
  voters: { address: string; vote: string }[];
  leader?: string;
};

function short(addr: string) {
  return addr.length > 14 ? `${addr.slice(0, 8)}…${addr.slice(-4)}` : addr;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarize(tx: any): ConsensusSummary {
  const votes: Record<string, string> =
    tx?.consensus_data?.votes ?? tx?.data?.consensus_data?.votes ?? {};
  const voters = Object.entries(votes).map(([address, vote]) => ({
    address,
    vote: String(vote),
  }));
  const tally = (v: string) =>
    voters.filter((x) => x.vote.toLowerCase() === v).length;
  const leader =
    tx?.lastLeader ?? tx?.consensus_data?.leader_receipt?.[0]?.node_config?.address;
  return {
    statusName: tx?.statusName ?? tx?.status_name ?? String(tx?.status ?? "—"),
    execution: tx?.txExecutionResultName ?? tx?.tx_execution_result_name,
    rounds: tx?.numOfRounds != null ? String(tx.numOfRounds) : undefined,
    agree: tally("agree"),
    disagree: tally("disagree"),
    other: voters.length - tally("agree") - tally("disagree"),
    voters,
    leader: leader ? String(leader) : undefined,
  };
}

export function ConsensusPanel({ hash }: { hash: string | null }) {
  const { getTx } = useWatchtowerContext();
  const [summary, setSummary] = useState<ConsensusSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hash) return;
    let alive = true;
    setSummary(null);
    setFailed(false);
    getTx(hash)
      .then((tx) => {
        if (alive) setSummary(summarize(tx));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [hash, getTx]);

  if (!hash) return null;

  return (
    <div className={`${cardCls} mt-4`}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="size-4" /> Consensus proof
      </h3>
      {!summary && !failed && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" /> Reading validator votes…
        </p>
      )}
      {failed && (
        <p className="mt-3 text-xs text-muted-foreground">
          Couldn&apos;t load the consensus receipt for{" "}
          <span className="font-mono">{short(hash)}</span>.
        </p>
      )}
      {summary && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Outcome</dt>
              <dd className="mt-0.5 font-medium">{summary.statusName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Execution</dt>
              <dd className="mt-0.5 font-medium">{summary.execution ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rounds</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{summary.rounds ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Votes</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                <span className="text-emerald-300">{summary.agree} agree</span>
                {summary.disagree > 0 && (
                  <span className="text-red-300"> · {summary.disagree} disagree</span>
                )}
                {summary.other > 0 && (
                  <span className="text-muted-foreground"> · {summary.other} other</span>
                )}
              </dd>
            </div>
          </dl>
          {summary.leader && (
            <p className="mt-3 font-mono text-xs text-muted-foreground" title={summary.leader}>
              leader {short(summary.leader)}
            </p>
          )}
          {summary.voters.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border pt-3">
              {summary.voters.map((v) => (
                <li
                  key={v.address}
                  className="flex items-center justify-between font-mono text-xs"
                  title={v.address}
                >
                  <span className="text-muted-foreground">{short(v.address)}</span>
                  <span
                    className={
                      v.vote.toLowerCase() === "agree" ? "text-emerald-300" : "text-red-300"
                    }
                  >
                    {v.vote}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground" title={hash}>
            tx {hash}
          </p>
          <a
            href={`https://explorer-studio.genlayer.com/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            View transaction in explorer →
          </a>
        </>
      )}
    </div>
  );
}
