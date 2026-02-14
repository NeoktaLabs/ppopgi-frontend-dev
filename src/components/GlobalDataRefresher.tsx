// src/components/GlobalDataRefresher.tsx
import { useEffect, useRef } from "react";
import { refresh as refreshRaffleStore } from "../hooks/useRaffleStore";
import { refresh as refreshActivityStore } from "../hooks/useActivityStore"; // <- you create this

function isVisible() {
  try {
    return document.visibilityState === "visible";
  } catch {
    return true;
  }
}

export function GlobalDataRefresher({ intervalMs = 5000 }: { intervalMs?: number }) {
  const runningRef = useRef(false);

  const tick = async (background = false) => {
    if (runningRef.current) return;
    if (background && !isVisible()) return;

    runningRef.current = true;
    try {
      // ✅ ORDER: raffles first, then events
      await refreshRaffleStore(true, true);
      await refreshActivityStore(true, true);

      window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
    } finally {
      runningRef.current = false;
    }
  };

  useEffect(() => {
    void tick(false);
    const id = window.setInterval(() => void tick(true), intervalMs);

    const onFocus = () => void tick(false);
    const onVis = () => document.visibilityState === "visible" && void tick(false);

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