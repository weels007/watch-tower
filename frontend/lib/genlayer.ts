"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  currentAccounts,
  discoverWallets,
  recalledWallet,
  rememberWallet,
  revokePermissions,
  switchToStudionet,
  type EIP1193Provider,
  type EIP6963ProviderDetail,
} from "@/lib/wallets";

export const CONTRACT_ADDRESS =
  "0x75a82361b32DFE26aFA481c7FB93a692517f21F7" as const;

export type Protocol = {
  name: string;
  monitor_endpoint: string;
  evidence_source: string;
  slash_conditions: string;
  active: boolean;
  total_policies: number;
};

export type Policy = {
  holder: string;
  protocol_id: string;
  premium: number;
  coverage: number;
  active: boolean;
  created_at: string;
};

export type Incident = {
  protocol_id: string;
  reporter: string;
  evidence_url: string;
  description: string;
  status: "pending" | "confirmed_violation" | "rejected" | "paid";
  severity: "none" | "low" | "medium" | "high" | "critical";
  confidence: number;
  reasoning: string;
  payout_amount: number;
};

export type ExternalWallet = {
  uuid: string;
  name: string;
  icon: string;
  address: string;
};

const ACCOUNT_KEY = "watchtower.account";
const CACHE_KEY = "watchtower.cache.v1";

type Snapshot = {
  ts: number;
  pool: string | null;
  protocols: { id: string; data: Protocol }[];
  incidents: { id: string; data: Incident }[];
};

function readCache(): Snapshot | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as Snapshot;
    if (!snap || typeof snap.ts !== "number" || !Array.isArray(snap.protocols)) return null;
    return snap;
  } catch {
    return null;
  }
}

function writeCache(snap: Snapshot) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snap));
  } catch {
    /* storage unavailable or full */
  }
}

function loadAccount() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACCOUNT_KEY);
    if (raw) return createAccount(raw as `0x${string}`);
  } catch {
    /* fall through to fresh account */
  }
  const key = generatePrivateKey();
  try {
    window.localStorage.setItem(ACCOUNT_KEY, key);
  } catch {
    /* storage unavailable */
  }
  return createAccount(key);
}

export function useWatchtower() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [client, setClient] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [account, setAccount] = useState<any>(null);
  const [pool, setPool] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);  const [protocols, setProtocols] = useState<{ id: string; data: Protocol }[]>([]);
  const [incidents, setIncidents] = useState<{ id: string; data: Incident }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [external, setExternal] = useState<ExternalWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const providerRef = useRef<EIP1193Provider | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountRef = useRef<any>(null);
  const accountsHandlerRef = useRef<((...args: unknown[]) => void) | null>(null);

  const detachListener = useCallback(() => {
    const provider = providerRef.current;
    const handler = accountsHandlerRef.current;
    if (provider?.removeListener && handler) {
      try {
        provider.removeListener("accountsChanged", handler);
      } catch {
        /* ignore */
      }
    }
    accountsHandlerRef.current = null;
  }, []);

  const applyWalletClient = useCallback(
    (address: string, provider: EIP1193Provider) => {
      // Official genlayer-js browser pattern: provider-backed client for
      // writes. NOTE: we deliberately do NOT call the SDK's connect() — it
      // talks to window.ethereum and requires the MetaMask-only snap.
      // Chain switching is done separately on the chosen provider.
      const wc = createClient({
        chain: studionet,
        account: address as `0x${string}`,
        provider: provider as never,
      });
      setClient(wc);
      return wc;
    },
    [],
  );

  const disconnectWallet = useCallback(async () => {
    const provider = providerRef.current;
    detachListener();
    if (provider) await revokePermissions(provider);
    providerRef.current = null;
    setExternal(null);
    rememberWallet(null);
    // Fall back to the local burner identity for reads and writes.
    if (accountRef.current) {
      setClient(createClient({ chain: studionet, account: accountRef.current }));
    }
  }, [detachListener]);

  const attachListener = useCallback(
    (provider: EIP1193Provider) => {
      detachListener();
      const handler = (...args: unknown[]) => {
        const accounts = args[0] as string[];
        if (!accounts || accounts.length === 0) {
          void disconnectWallet();
          return;
        }
        // Wallet switched accounts: rebind the signing client so writes come
        // from the newly selected account instead of the stale one.
        const next = accounts[0];
        setExternal((prev) => {
          if (prev && prev.address.toLowerCase() !== next.toLowerCase()) {
            setClient(
              createClient({
                chain: studionet,
                account: next as `0x${string}`,
                provider: provider as never,
              }),
            );
            rememberWallet({ uuid: prev.uuid, address: next });
            return { ...prev, address: next };
          }
          return prev;
        });
      };
      accountsHandlerRef.current = handler;
      try {
        provider.on?.("accountsChanged", handler);
      } catch {
        /* provider without events */
      }
    },
    [detachListener, disconnectWallet],
  );

  const connectWallet = useCallback(
    async (detail: EIP6963ProviderDetail) => {
      setConnecting(true);
      try {
        const accounts = (await detail.provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (!accounts[0]) throw new Error("Wallet returned no accounts.");
        applyWalletClient(accounts[0], detail.provider);
        // Switches the chosen wallet to the exact GenLayer chain before
        // signing (manual add+switch — works on every EIP-1193 wallet).
        await switchToStudionet(detail.provider);
        providerRef.current = detail.provider;
        attachListener(detail.provider);
        setExternal({
          uuid: detail.info.uuid,
          name: detail.info.name,
          icon: detail.info.icon,
          address: accounts[0],
        });
        rememberWallet({ uuid: detail.info.uuid, address: accounts[0] });
      } finally {
        setConnecting(false);
      }
    },
    [applyWalletClient, attachListener],
  );

  useEffect(() => {
    const acc = loadAccount();
    if (!acc) return;
    accountRef.current = acc;
    setAccount(acc);
    setClient(createClient({ chain: studionet, account: acc }));
  }, []);

  // Silent auto-restore: if the same wallet announces itself again and is
  // still authorized (eth_accounts, no prompt), resume the session.
  useEffect(() => {
    const remembered = recalledWallet();
    if (!remembered) return;
    const stop = discoverWallets(async (wallets) => {
      const match = wallets.find((w) => w.info.uuid === remembered.uuid);
      if (!match || providerRef.current) return;
      const accounts = await currentAccounts(match.provider);
      if (!accounts.map((a) => a.toLowerCase()).includes(remembered.address.toLowerCase()))
        return;
      stop();
      try {
        applyWalletClient(remembered.address, match.provider);
        await switchToStudionet(match.provider);
        providerRef.current = match.provider;
        attachListener(match.provider);
        setExternal({
          uuid: match.info.uuid,
          name: match.info.name,
          icon: match.info.icon,
          address: remembered.address,
        });
      } catch {
        rememberWallet(null);
      }
    });
    return stop;
  }, [applyWalletClient, attachListener]);

  useEffect(() => detachListener, [detachListener]);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!client) return;
      const silent = opts?.silent ?? false;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        // Wave 1: every independent read fires at once (~1.3s each on
        // studionet, so serial awaits would stack thousands of ms).
        setSyncPhase("lists");
        const [poolBal, ids, incIds] = await Promise.all([
          client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_pool_balance",
            args: [],
          }),
          client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "list_protocols",
            args: [],
          }) as Promise<string[]>,
          client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "list_incidents",
            args: [],
          }) as Promise<string[]>,
        ]);
        const poolStr = String(poolBal);
        setPool(poolStr);

        // Wave 2: all detail reads in parallel.
        setSyncPhase("details");
        const [protos, incs] = await Promise.all([
          Promise.all(
            ids.map(async (id) => ({
              id,
              data: (await client.readContract({
                address: CONTRACT_ADDRESS,
                functionName: "get_protocol",
                args: [id],
              })) as Protocol,
            })),
          ),
          Promise.all(
            incIds.slice(-12).map(async (id) => ({
              id,
              data: (await client.readContract({
                address: CONTRACT_ADDRESS,
                functionName: "get_incident",
                args: [id],
              })) as Incident,
            })),
          ),
        ]);
        setProtocols(protos);
        const ordered = incs.reverse();
        setIncidents(ordered);

        const ts = Date.now();
        setUpdatedAt(ts);
        writeCache({ ts, pool: poolStr, protocols: protos, incidents: ordered });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSyncPhase(null);
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client],
  );

  useEffect(() => {
    // Cache-first boot: paint the last snapshot instantly, then revalidate
    // quietly in the background. Navigation between pages never refetches
    // because this provider outlives route changes.
    const snap = readCache();
    if (snap) {
      setPool(snap.pool);
      setProtocols(snap.protocols);
      setIncidents(snap.incidents);
      setUpdatedAt(snap.ts);
      setLoading(false);
      void refresh({ silent: true });
    } else {
      void refresh();
    }
  }, [refresh]);

  const write = useCallback(
    async (functionName: string, args: unknown[], value: bigint | number = 0) => {
      if (!client) throw new Error("Wallet not ready");
      const hash = (await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        value: BigInt(value),
      })) as string;
      // Shared studionet consensus varies with load and rotation rounds —
      // allow up to ~20 minutes instead of the SDK's ~2.5 minute default.
      let receipt: unknown;
      try {
        receipt = await client.waitForTransactionReceipt({
          hash,
          interval: 5000,
          retries: 240,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/timed out|timeout/i.test(msg)) {
          throw new Error(
            `Consensus is taking longer than usual and is still processing (tx ${hash.slice(0, 12)}…). Wait a bit, then hit Refresh — your transaction is not lost.`,
          );
        }
        throw e;
      }
      await refresh({ silent: true });
      return { hash, receipt };
    },
    [client, refresh],
  );

  const getTx = useCallback(
    async (hash: string) => {
      if (!client) throw new Error("Client not ready");
      return client.getTransaction({ hash });
    },
    [client],
  );

  const activeAddress = external?.address ?? (account?.address as string | undefined);

  useEffect(() => {
    if (!client || !activeAddress) {
      setBalance(null);
      return;
    }
    let alive = true;
    client
      .getBalance({ address: activeAddress as `0x${string}` })
      .then((b: unknown) => {
        if (alive) setBalance(String(b));
      })
      .catch(() => {
        if (alive) setBalance(null);
      });
    return () => {
      alive = false;
    };
  }, [client, activeAddress]);

  return {
    client,
    account,
    external,
    connecting,
    connectWallet,
    disconnectWallet,
    activeAddress,
    balance,
    pool,
    protocols,
    incidents,
    loading,
    refreshing,
    syncPhase,
    updatedAt,
    error,
    refresh,
    write,
    getTx,
  };
}
