"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Radar, X } from "lucide-react";
import { CONTRACT_ADDRESS } from "@/lib/genlayer";
import { formatGen } from "@/lib/format";
import { ConnectWallet } from "@/components/connect-wallet";
import { useWatchtowerContext } from "@/components/watchtower-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/protocols", label: "Protocols" },
  { href: "/coverage", label: "Coverage" },
  { href: "/incidents", label: "Incidents" },
  { href: "/claims", label: "Claims" },
];

export function SiteHeader() {
  const { external, connecting, connectWallet, disconnectWallet, balance } = useWatchtowerContext();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-18 w-full max-w-[90rem] items-center justify-between px-6 py-3 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background">
            <Radar className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight">Watchtower</span>
            <span className="block text-[11px] text-muted-foreground">
              Slashing monitoring & insurance
            </span>
          </span>
          <span className="ml-1 hidden rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground sm:inline">
            studionet
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-[15px] text-muted-foreground lg:flex">
          {NAV.map((item) => {
            const active =
              item.href.startsWith("/#") || pathname === "/"
                ? false
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground",
                  active && "font-medium text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-xs">
          {balance !== null && (
            <a
              href="https://studio.genlayer.com/"
              target="_blank"
              rel="noreferrer"
              title="Top up test GEN via the Studio faucet"
              className="hidden rounded-full border border-border px-2.5 py-1.5 font-mono text-muted-foreground hover:text-foreground sm:inline"
            >
              {formatGen(balance)} GEN
            </a>
          )}
          <ConnectWallet
            wallet={external}
            busy={connecting}
            onPick={connectWallet}
            onDisconnect={disconnectWallet}
          />
          <button
            aria-label="Menu"
            onClick={() => setMenu(!menu)}
            className="rounded-lg border border-border p-2 lg:hidden"
          >
            {menu ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {menu && (
        <nav className="border-t border-border px-6 py-3 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenu(false)}
              className="block rounded-lg px-2 py-2.5 text-[15px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background">
              <Radar className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Watchtower</span>
          </div>
          <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-muted-foreground">
            Slashing monitoring and insurance on GenLayer. Violations are judged
            by decentralized validator consensus over live web evidence — not by
            a single oracle or committee — and payouts settle from the on-chain
            pool.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Explore</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium">Resources</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <a
                href={`https://studio.genlayer.com/contracts/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                View contract in Studio
              </a>
            </li>
            <li>
              <a href="https://docs.genlayer.com/" target="_blank" rel="noreferrer" className="hover:text-foreground">
                GenLayer docs
              </a>
            </li>
            <li>
              <a href="https://studio.genlayer.com/" target="_blank" rel="noreferrer" className="hover:text-foreground">
                GenLayer Studio
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto w-full max-w-[90rem] px-6 py-5 text-xs text-muted-foreground lg:px-10">
          Demo on studionet — coverage, premiums and payouts use test tokens.
        </p>
      </div>
    </footer>
  );
}
