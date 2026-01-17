// src/lib/useNowTick.ts
import { useEffect, useState } from "react";

export function useNowTick(enabled = true, stepMs = 30_000) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNowMs(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [enabled, stepMs]);

  return nowMs;
}