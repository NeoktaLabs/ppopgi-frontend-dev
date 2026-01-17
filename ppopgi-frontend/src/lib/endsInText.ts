// src/lib/endsInText.ts
export function endsInText(deadlineSec: number, nowMs: number) {
  if (!Number.isFinite(deadlineSec) || deadlineSec <= 0) return "—";

  const diffMs = deadlineSec * 1000 - nowMs;
  if (diffMs <= 0) return "Ended";

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Ends in ${minutes}m`;
  return `Ends in ${seconds}s`;
}