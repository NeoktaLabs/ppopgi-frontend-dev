export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export function shortAddress(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function isZeroAddr(a?: string | null) {
  if (!a) return true;
  return a.toLowerCase() === ZERO_ADDR;
}
