/**
 * GEN nominal conversion. Users type whole GEN ("1", "100", "0.5");
 * the chain counts base units (1 GEN = 10^18). String-based math avoids
 * float rounding entirely.
 */

const DECIMALS = 18;
const UNIT = 10n ** BigInt(DECIMALS);

/** "1.5" -> 1500000000000000000n. Returns null when the input is not a valid amount. */
export function parseGen(input: string): bigint | null {
  const s = input.trim().replace(/,/g, ".");
  if (!/^(\d+)(\.\d{1,18})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  try {
    return BigInt(whole) * UNIT + BigInt((frac + "0".repeat(DECIMALS)).slice(0, DECIMALS));
  } catch {
    return null;
  }
}

/** Unix seconds -> short UTC date. Accepts number or numeric string. */
export function formatTs(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  try {
    return new Date(n * 1000).toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return String(value);
  }
}

/** 1500000000000000000n -> "1.5". Accepts bigint, number or numeric string. */
export function formatGen(value: bigint | number | string): string {
  let bi: bigint;
  try {
    bi = typeof value === "bigint" ? value : BigInt(value as number | string);
  } catch {
    return String(value);
  }
  const neg = bi < 0n;
  const abs = neg ? -bi : bi;
  const whole = (abs / UNIT).toString();
  const frac = (abs % UNIT).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}
