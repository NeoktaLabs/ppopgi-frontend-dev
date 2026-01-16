import { formatUnits } from "viem";

export function formatToken(
  value?: string | number | bigint | null,
  decimals = 6,
  maxFrac = 6
) {
  if (value == null) return "0";

  let v: bigint;
  try {
    v = typeof value === "bigint" ? value : BigInt(value);
  } catch {
    return "0";
  }

  const s = formatUnits(v, decimals);
  const [i, f] = s.split(".");
  if (!f) return i;

  return `${i}.${f.slice(0, maxFrac)}`.replace(/\.$/, "");
}