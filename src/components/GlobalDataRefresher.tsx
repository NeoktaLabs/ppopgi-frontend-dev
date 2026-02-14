// src/components/GlobalDataRefresher.tsx
import { useEffect, useRef } from "react";
import { refresh as refreshRaffleStore } from "../hooks/useRaffleStore";

function isVisible() {
  try {
    return document.visibilityState === "visible";
  } catch {
    return true;
  }
}

export function GlobalDataRefresher({ intervalMs = 5000 }: { intervalMs?: number }) {
  const runningRef = useRef(false);
  const lastRaffleRefreshAtRef = useRef(0);

  const tick = async (background = false) => {
    if (runningRef.current) return;
    if (background && !isVisible()) return;

    runningRef.current = true;
    try {
      // ✅ Always emit a lightweight "sync" tick (Home/Explore/Dashboard listeners decide what to do)
      try {
        window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
      } catch {}

      // ✅ Raffle store refresh: DO NOT do every 5s, it’s expensive.
      // Throttle to e.g. 20s (tune as you like).
      const now = Date.now();
      const RAFFLE_REFRESH_MIN_GAP_MS = 20_000;

      if (!background || now - lastRaffleRefreshAtRef.current >= RAFFLE_REFRESH_MIN_GAP_MS) {
        lastRaffleRefreshAtRef.current = now;
        await refreshRaffleStore(true, true);
      }
    } finally {
      runningRef.current = false;
    }
  };

  useEffect(() => {
    void tick(false);

    const id = window.setInterval(() => void tick(true), intervalMs);

    const onFocus = () => void tick(false);
    const onVis = () => {
      try {
        if (document.visibilityState === "visible") void tick(false);
      } catch {}
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  return null;
}

export default GlobalDataRefresher;