import { formatUnits } from "ethers";

/**
 * USDC is 6 decimals on Etherlink.
 * Kept defensive because indexer/chain data can be missing.
 */
export function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

export function formatEndsIn(deadlineSeconds: string, nowMs: number) {
  const n = Number(deadlineSeconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown";

  const deadlineMs = n * 1000;
  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) return "Ended";

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad2 = (x: number) => String(x).padStart(2, "0");
  const d = days > 0 ? `${days}d ` : "";
  return `${d}${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}

export function formatWhen(tsSeconds: string | null | undefined) {
  const n = Number(tsSeconds || "0");
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  try {
    return new Date(n * 1000).toLocaleString();
  } catch {
    return "Unknown time";
  }
}
