// src/hooks/useHomeRaffles.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { fetchRafflesFromSubgraph } from "../indexer/subgraph";
import { fetchRafflesOnChainFallback } from "../onchain/fallbackRaffles";

type Mode = "indexer" | "live";

function numOr0(v?: string | null) {
  const n = Number(v || "0");
  return Number.isFinite(n) ? n : 0;
}

function isRateLimitError(e: any) {
  const msg = String(e?.message ?? e ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("too many requests") || msg.includes("rate");
}

export function useHomeRaffles() {
  const [items, setItems] = useState<RaffleListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("indexer");
  const [note, setNote] = useState<string | null>(null);

  // --- polling / throttling ---
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const backoffStepRef = useRef(0);

  // light cache to avoid hammering indexer when navigating back/forth
  const cacheRef = useRef<{ at: number; data: RaffleListItem[]; mode: Mode } | null>(null);
  const CACHE_MS = 15_000;

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = useCallback((ms: number) => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      fetchData(true);
    }, ms);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(
    async (isBackground = false) => {
      // don’t background-poll when tab hidden
      if (isBackground && typeof document !== "undefined" && document.hidden) {
        scheduleNext(60_000);
        return;
      }
      if (inFlightRef.current) return;

      const now = Date.now();
      if (cacheRef.current && now - cacheRef.current.at < CACHE_MS) {
        if (!isBackground) setIsLoading(false);
        setItems(cacheRef.current.data);
        setMode(cacheRef.current.mode);
        setNote(null);
        scheduleNext(isBackground ? 30_000 : 12_000);
        return;
      }

      inFlightRef.current = true;
      if (!isBackground) setIsLoading(true);

      // abort any previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // keep your fast timeout on first load
        const t = window.setTimeout(() => controller.abort(), 4500);

        // IMPORTANT: keep "first" reasonable; home doesn’t need 1000
        const data = await fetchRafflesFromSubgraph({
          first: 200,
          signal: controller.signal,
        });

        window.clearTimeout(t);

        setMode("indexer");
        setNote(null);
        setItems(data);

        cacheRef.current = { at: Date.now(), data, mode: "indexer" };
        backoffStepRef.current = 0;

        scheduleNext(isBackground ? 30_000 : 12_000);
      } catch (err) {
        // rate-limited → backoff (avoid “too many requests” spiral)
        if (isRateLimitError(err)) {
          backoffStepRef.current = Math.min(backoffStepRef.current + 1, 4);
          const delays = [15_000, 30_000, 60_000, 120_000, 180_000];
          scheduleNext(delays[backoffStepRef.current]);
          if (!isBackground) setNote("Too many requests. Retrying shortly…");
          console.error("Home indexer rate-limited", err);
          return;
        }

        // only fallback on foreground (your original behavior)
        if (!isBackground) {
          try {
            setMode("live");
            setNote("Indexer unavailable. Showing live blockchain data.");
            const data = await fetchRafflesOnChainFallback(50);
            setItems(data);

            cacheRef.current = { at: Date.now(), data, mode: "live" };
            scheduleNext(20_000); // a bit slower in live mode
          } catch (fallbackErr) {
            console.error("Fallback failed", fallbackErr);
            setNote("Could not load raffles. Please refresh.");
            scheduleNext(30_000);
          }
        } else {
          // background failure: just slow down
          scheduleNext(45_000);
        }
      } finally {
        inFlightRef.current = false;
        if (!isBackground) setIsLoading(false);
      }
    },
    [scheduleNext]
  );

  useEffect(() => {
    fetchData(false);

    const onFocus = () => {
      cacheRef.current = null;
      backoffStepRef.current = 0;
      fetchData(false);
    };

    const onVis = () => {
      if (!document.hidden) {
        cacheRef.current = null;
        backoffStepRef.current = 0;
        fetchData(false);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearTimer();
      abortRef.current?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchData]);

  const all = useMemo(() => items ?? [], [items]);

  const active = useMemo(() => {
    return all.filter((r) => r.status === "OPEN" || r.status === "FUNDING_PENDING");
  }, [all]);

  const bigPrizes = useMemo(() => {
    return [...active]
      .sort((a, b) => {
        const A = BigInt(a.winningPot || "0");
        const B = BigInt(b.winningPot || "0");
        if (A === B) return 0;
        return A > B ? -1 : 1;
      })
      .slice(0, 3);
  }, [active]);

  const endingSoon = useMemo(() => {
    return [...active]
      .filter((r) => r.status === "OPEN")
      .sort((a, b) => numOr0(a.deadline) - numOr0(b.deadline))
      .slice(0, 5);
  }, [active]);

  const recentlyFinalized = useMemo(() => {
    if (mode === "live") return [];
    const settled = all.filter((r) => r.status === "COMPLETED");
    return [...settled]
      .sort((a, b) => {
        const aKey =
          numOr0(a.completedAt) || numOr0(a.finalizedAt) || numOr0(a.lastUpdatedTimestamp);
        const bKey =
          numOr0(b.completedAt) || numOr0(b.finalizedAt) || numOr0(b.lastUpdatedTimestamp);
        return bKey - aKey;
      })
      .slice(0, 5);
  }, [all, mode]);

  const stats = useMemo(() => {
    const totalRaffles = all.length;

    const settledVolume = all.reduce((acc, r) => {
      if (r.status === "COMPLETED") return acc + BigInt(r.winningPot || "0");
      return acc;
    }, 0n);

    const activeVolume = active.reduce((acc, r) => acc + BigInt(r.winningPot || "0"), 0n);

    return { totalRaffles, settledVolume, activeVolume };
  }, [all, active]);

  const refetch = () => {
    cacheRef.current = null;
    backoffStepRef.current = 0;
    fetchData(false);
  };

  return {
    items,
    bigPrizes,
    endingSoon,
    recentlyFinalized,
    stats,
    mode,
    note,
    isLoading,
    refetch,
  };
}