"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner, safeIcon } from "@/components/ui-bits";
import {
  discoverWallets,
  formatProviderError,
  type EIP6963ProviderDetail,
} from "@/lib/wallets";

export type ConnectedWallet = {
  uuid: string;
  name: string;
  icon: string;
  address: string;
};

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Always offered inside the popup. If the wallet announced itself via
 *  EIP-6963 the row connects; otherwise it links to the install page. */
const KNOWN_WALLETS = [
  { rdns: "io.metamask", name: "MetaMask", install: "https://metamask.io/download/" },
  { rdns: "io.rabby", name: "Rabby", install: "https://rabby.io/" },
];

export function ConnectWallet({
  wallet,
  onPick,
  onDisconnect,
  busy,
}: {
  wallet: ConnectedWallet | null;
  onPick: (detail: EIP6963ProviderDetail) => Promise<void>;
  onDisconnect: () => Promise<void> | void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<EIP6963ProviderDetail[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  // Portal target: the popup must live on document.body, because the header's
  // backdrop-blur makes it a containing block that would trap `fixed`
  // descendants inside the header box.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || wallet) return;
    setModalError(null);
    return discoverWallets(setWallets);
  }, [open, wallet]);

  const pick = async (detail: EIP6963ProviderDetail) => {
    if (picking) return;
    setPicking(detail.info.uuid);
    setModalError(null);
    try {
      // One flow per click: permission prompt + chain switch, both from
      // THIS wallet only — no other extension is ever touched.
      await onPick(detail);
      setOpen(false);
    } catch (e) {
      const msg = formatProviderError(e);
      // eslint-disable-next-line no-console
      console.error(`[watchtower] connect ${detail.info.name} failed:`, e);
      setModalError(
        msg.includes("rejected") || msg.includes("denied")
          ? `Connection rejected in ${detail.info.name}. Approve it there, then try again.`
          : `${detail.info.name} could not connect: ${msg}`,
      );
    } finally {
      setPicking(null);
    }
  };

  const rows = KNOWN_WALLETS.map((known) => ({
    ...known,
    detail: wallets.find((w) => w.info.rdns === known.rdns) ?? null,
  }));
  const others = wallets.filter(
    (w) => !KNOWN_WALLETS.some((k) => k.rdns === w.info.rdns),
  );

  if (wallet) {
    return (
      <div className="relative">
        <button
          onClick={() => setMenu(!menu)}
          className="flex items-center gap-2 rounded-full border border-border bg-background/80 py-1.5 pl-1.5 pr-3 text-sm backdrop-blur"
        >
          {wallet.icon && safeIcon(wallet.icon) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wallet.icon} alt="" className="size-6 rounded-full" />
          ) : (
            <Wallet className="size-4" />
          )}
          <span className="font-mono text-xs" title={wallet.address}>
            {short(wallet.address)}
          </span>
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-border bg-popover p-2 shadow-xl">
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Connected via {wallet.name}
              </p>
              <p className="truncate px-2 pb-1 font-mono text-xs" title={wallet.address}>
                {wallet.address}
              </p>
              <button
                onClick={() => {
                  setMenu(false);
                  void onDisconnect();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-400 hover:bg-muted"
              >
                <LogOut className="size-4" /> Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        <Wallet className="size-4" />
        {busy ? "Connecting…" : "Connect wallet"}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60"
            onClick={() => setOpen(false)}
          >
          <div className="flex min-h-full items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal
            aria-label="Choose a wallet"
            className="max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-popover p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold tracking-tight">Choose a wallet</h2>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Each wallet signs through its own provider — they never fight over
              the connection.
            </p>

            {modalError && (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-xs text-red-200">
                {modalError}
              </div>
            )}

            <div className="mt-4 space-y-2">
              {rows.map((row) =>
                row.detail ? (
                  <button
                    key={row.rdns}
                    disabled={picking !== null}
                    onClick={() => void pick(row.detail as EIP6963ProviderDetail)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-muted",
                      picking === row.detail.info.uuid && "opacity-60",
                    )}
                  >
                    {row.detail.info.icon && safeIcon(row.detail.info.icon) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.detail.info.icon} alt="" className="size-8 rounded-lg" />
                    ) : (
                      <Wallet className="size-6 text-muted-foreground" />
                    )}
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{row.name}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        detected · click to connect
                      </span>
                    </span>
                    {picking === row.detail.info.uuid && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Spinner className="size-3.5" /> Waiting…
                      </span>
                    )}
                  </button>
                ) : (
                  <a
                    key={row.rdns}
                    href={row.install}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-muted"
                  >
                    <Wallet className="size-6 text-muted-foreground" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{row.name}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        not detected · install
                      </span>
                    </span>
                  </a>
                ),
              )}
              {others.map((w) => (
                <button
                  key={w.info.uuid}
                  disabled={picking !== null}
                  onClick={() => void pick(w)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-muted",
                    picking === w.info.uuid && "opacity-60",
                  )}
                >
                  {w.info.icon && safeIcon(w.info.icon) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.info.icon} alt="" className="size-8 rounded-lg" />
                  ) : (
                    <Wallet className="size-6 text-muted-foreground" />
                  )}
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{w.info.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {w.info.rdns}
                    </span>
                  </span>
                  {picking === w.info.uuid && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Spinner className="size-3.5" /> Waiting…
                    </span>
                  )}
                </button>
              ))}
            </div>

            {wallets.length === 0 && (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Nothing detected yet — install or unlock a wallet above, then
                close and reopen this popup.
              </p>
            )}
            </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
