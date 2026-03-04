import { useEffect, useRef } from "react";
import { refresh as refreshLotteryStore } from "../hooks/useLotteryStore";
import { refresh as refreshActivityStore } from "../hooks/useActivityStore";

function isVisible() {
  try {
    return document.visibilityState === "visible";
  } catch {
    return true;
  }
}

export function GlobalDataRefresher({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const runningRef = useRef(false);
  const lastLotteryRefreshAtRef = useRef(0);
  const lastActivityRefreshAtRef = useRef(0);
  const lastSoftRevalidateAtRef = useRef(0);

  const tick = async (background = false) => {
    if (runningRef.current) return;
    if (background && !isVisible()) return;

    runningRef.current = true;

    try {
      const now = Date.now();

      // Keep these aligned with your cache TTLs + store throttles
      const ACTIVITY_MIN_GAP_MS = 15_000; // activity is cheap, but don’t spam
      const LOTTERY_REFRESH_MIN_GAP_MS = 30_000; // heavier; safer than 20s once stores are burst-driven
      const SOFT_REVALIDATE_MIN_GAP_MS = 5_000; // avoid spamming listeners

      const shouldRefreshActivity = !background || now - lastActivityRefreshAtRef.current >= ACTIVITY_MIN_GAP_MS;
      const shouldRefreshLotteries = !background || now - lastLotteryRefreshAtRef.current >= LOTTERY_REFRESH_MIN_GAP_MS;

      if (shouldRefreshActivity) lastActivityRefreshAtRef.current = now;
      if (shouldRefreshLotteries) lastLotteryRefreshAtRef.current = now;

      const tasks: Promise<any>[] = [];

      // ✅ IMPORTANT: do NOT force-fresh on polling.
      // Let worker cache + store logic do their job.
      if (shouldRefreshActivity) tasks.push(refreshActivityStore(true, false));
      if (shouldRefreshLotteries) tasks.push(refreshLotteryStore(true, false));

      await Promise.allSettled(tasks);

      // ✅ Soft revalidate only (never "force" from the refresher)
      // This lets stores/hooks recompute derived UI without entering burst mode.
      if (now - lastSoftRevalidateAtRef.current >= SOFT_REVALIDATE_MIN_GAP_MS) {
        lastSoftRevalidateAtRef.current = now;
        try {
          window.dispatchEvent(new CustomEvent("ppopgi:revalidate", { detail: { force: false } }));
        } catch {}
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