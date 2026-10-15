/**
 * EIP-6963 multi-wallet discovery.
 *
 * MetaMask, Rabby and other EVM wallets all inject into the page. Talking to
 * `window.ethereum` directly is a race — whichever wallet wins the injection
 * fight answers every call. EIP-6963 fixes that: each wallet announces itself
 * with an event carrying its own provider object, so the user picks exactly
 * which wallet signs.
 */

export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
};

export type EIP6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type EIP6963ProviderDetail = {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
};

const STORAGE_KEY = "watchtower.wallet";

export type RememberedWallet = { uuid: string; address: string };

export function rememberWallet(w: RememberedWallet | null) {
  try {
    if (w) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function recalledWallet(): RememberedWallet | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RememberedWallet) : null;
  } catch {
    return null;
  }
}

/**
 * Collect announced wallets. Returns an unsubscribe function.
 * Safe to call during render-guarded effects only (uses `window`).
 */
export function discoverWallets(
  onUpdate: (wallets: EIP6963ProviderDetail[]) => void,
): () => void {
  const found = new Map<string, EIP6963ProviderDetail>();
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<EIP6963ProviderDetail>).detail;
    if (!detail?.info?.uuid || found.has(detail.info.uuid)) return;
    found.set(detail.info.uuid, detail);
    onUpdate([...found.values()]);
  };
  window.addEventListener("eip6963:announceProvider", handler);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  // Late-loading wallets (extension boots after us) announce on their own
  // schedule; the listener above keeps collecting them.
  return () => window.removeEventListener("eip6963:announceProvider", handler);
}

export async function requestAccounts(provider: EIP1193Provider): Promise<string[]> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  return accounts ?? [];
}

export async function currentAccounts(provider: EIP1193Provider): Promise<string[]> {
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return accounts ?? [];
  } catch {
    return [];
  }
}

/** Best-effort permission revoke (MetaMask/Rabby support it, others ignore). */
export async function revokePermissions(provider: EIP1193Provider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    /* not supported — app-side disconnect still applies */
  }
}

/**
 * Render any thrown value as a human-readable message. EIP-1193 wallet
 * errors are plain objects ({code, message, data}) — NOT Error instances —
 * so `String(e)` would print the useless "[object Object]".
 */
export function formatProviderError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object" && e !== null) {
    const o = e as { code?: unknown; message?: unknown; reason?: unknown; data?: unknown };
    const parts: string[] = [];
    if (o.code !== undefined) parts.push(`code ${String(o.code)}`);
    if (typeof o.message === "string" && o.message) parts.push(o.message);
    if (typeof o.reason === "string" && o.reason) parts.push(o.reason);
    if (parts.length > 0) return parts.join(" — ");
    try {
      const json = JSON.stringify(e);
      if (json && json !== "{}") return json;
    } catch {
      /* fall through */
    }
  }
  return String(e);
}

const STUDIONET_ID = 61999;
const STUDIONET_ID_HEX = `0x${STUDIONET_ID.toString(16)}`;

/**
 * Switch the CHOSEN provider to the GenLayer studionet chain.
 *
 * The SDK's own `client.connect()` cannot be used here: it talks to the
 * global `window.ethereum` (the injection race) and demands the MetaMask-only
 * GenLayer Snap (`wallet_getSnaps`), which Rabby and friends reject. Plain
 * signing via `personal_sign` needs no snap, so a plain add+switch is enough.
 */
export async function switchToStudionet(provider: EIP1193Provider): Promise<void> {
  let current: string | null = null;
  try {
    current = (await provider.request({ method: "eth_chainId" })) as string;
  } catch {
    /* some providers only answer after accounts are granted — proceed */
  }
  if (current && current.toLowerCase() === STUDIONET_ID_HEX) return;
  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: STUDIONET_ID_HEX,
          chainName: "Genlayer Studio Network",
          rpcUrls: ["https://studio.genlayer.com/api"],
          nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
          blockExplorerUrls: ["https://genlayer-explorer.vercel.app"],
        },
      ],
    });
  } catch (e) {
    // 4902 = chain not recognized by an add-first wallet; most wallets add
    // implicitly, so only surface real failures. Rejection stays fatal.
    const msg = formatProviderError(e).toLowerCase();
    if (msg.includes("reject") || msg.includes("denied") || msg.includes("cancelled")) {
      throw new Error("Network switch rejected in the wallet.");
    }
    throw new Error(`Could not add the GenLayer network: ${formatProviderError(e)}`);
  }
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_ID_HEX }],
    });
  } catch (e) {
    const msg = formatProviderError(e).toLowerCase();
    if (msg.includes("reject") || msg.includes("denied") || msg.includes("cancelled")) {
      throw new Error("Network switch rejected in the wallet.");
    }
    throw new Error(`Could not switch to the GenLayer network: ${formatProviderError(e)}`);
  }
}
