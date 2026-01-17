import { useEffect, useMemo, useState } from "react";

export function useEndsIn(deadlineSec: number) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const diffMs = deadlineSec * 1000 - nowMs;

  useEffect(() => {
    if (!Number.isFinite(deadlineSec) || deadlineSec <= 0) return;
    if (diffMs <= 0) return;

    // Adaptive refresh
    let interval = 60_000; // default 1 min
    if (diffMs <= 60_000) interval = 1_000; // last minute: 1s
    else if (diffMs <= 3_600_000) interval = 30_000; // last hour: 30s

    const id = window.setInterval(() => setNowMs(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [deadlineSec, diffMs]);

  return useMemo(() => {
    if (!Number.isFinite(deadlineSec) || deadlineSec <= 0) return "—";
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
  }, [deadlineSec, diffMs]);
}