// src/hooks/useExploreController.ts
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  fetchRafflesFromSubgraph,
  type RaffleListItem,
  type RaffleStatus,
} from "../indexer/subgraph";

export type SortMode = "endingSoon" | "bigPrize" | "newest";

const norm = (s: string) => (s || "").trim().toLowerCase();
const safeNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const isActiveStatus = (s: RaffleStatus) => s === "OPEN" || s === "FUNDING_PENDING";

// --- small helpers ---
function isRateLimitError(e: any) {
  const msg = String(e?.message ?? e ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("too many requests") || msg.includes("rate");
}

export function useExploreController() {
  const activeAccount = useActiveAccount();
  const me = activeAccount?.address ? norm(activeAccount.address) : null;

  // --- State ---
  const [items, setItems] = useState<RaffleListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RaffleStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortMode>("newest");
  const [openOnly, setOpenOnly] = useState(false);
  const [myRafflesOnly, setMyRafflesOnly] = useState(false);

  // --- Polling / throttling controls ---
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const backoffStepRef = useRef(0);

  // simple cache (reduces subgraph calls when user navigates around)
  const cacheRef = useRef<{ at: number; data: RaffleListItem[] } | null>(null);
  const CACHE_MS = 20_000;

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = useCallback((ms: number) => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      // background tick
      fetchData(true);
    }, ms);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(
    async (isBackground = false) => {
      // Don’t poll when tab is hidden (mobile Safari backgrounded, etc.)
      if (isBackground && typeof document !== "undefined" && document.hidden) {
        scheduleNext(60_000);
        return;
      }

      // in-flight dedupe
      if (inFlightRef.current) return;

      // cache hit (avoid hitting indexer too often)
      const now = Date.now();
      if (cacheRef.current && now - cacheRef.current.at < CACHE_MS) {
        if (!isBackground) setIsLoading(false);
        setItems(cacheRef.current.data);
        setNote(null);
        scheduleNext(isBackground ? 30_000 : 12_000);
        return;
      }

      // start request
      inFlightRef.current = true;
      if (!isBackground) setIsLoading(true);

      // abort previous request if any
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // (optional) smaller first to reduce load; keep 1000 if you need full list
        const data = await fetchRafflesFromSubgraph({ first: 1000, signal: controller.signal });

        cacheRef.current = { at: Date.now(), data };
        backoffStepRef.current = 0;

        setItems(data);
        setNote(null);

        // active page: frequent-ish; background: slower
        scheduleNext(isBackground ? 30_000 : 12_000);
      } catch (e) {
        // ignore abort errors
        const msg = String(e?.name ?? "") === "AbortError" ? "" : String(e?.message ?? e ?? "");
        if (!isBackground && msg) setNote("Failed to load raffles.");

        // backoff aggressively on rate-limit
        if (isRateLimitError(e)) {
          backoffStepRef.current = Math.min(backoffStepRef.current + 1, 4);
          const delays = [15_000, 30_000, 60_000, 120_000, 180_000];
          scheduleNext(delays[backoffStepRef.current]);
          if (!isBackground) setNote("Too many requests. Retrying shortly…");
        } else {
          scheduleNext(isBackground ? 45_000 : 20_000);
        }

        console.error("Explore fetch failed", e);
      } finally {
        inFlightRef.current = false;
        if (!isBackground) setIsLoading(false);
      }
    },
    [scheduleNext]
  );

  // --- Lifecycle ---
  useEffect(() => {
    fetchData(false);

    const onFocus = () => {
      // force refresh when user comes back
      cacheRef.current = null;
      fetchData(false);
    };

    const onVis = () => {
      if (!document.hidden) {
        cacheRef.current = null;
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

  // --- Filtering Logic (Memoized) ---
  const list = useMemo(() => {
    const all = items ?? [];
    let filtered = status === "ALL" ? all : all.filter((r) => r.status === status);

    if (openOnly) filtered = filtered.filter((r) => isActiveStatus(r.status));

    if (myRafflesOnly && me) {
      filtered = filtered.filter((r: any) => (r.creator ? norm(String(r.creator)) : null) === me);
    }

    const query = norm(q);
    if (query) {
      filtered = filtered.filter((r) =>
        `${r.name || ""} ${r.id || ""}`.toLowerCase().includes(query)
      );
    }

    // IMPORTANT: don’t mutate the original array
    return [...filtered].sort((a, b) => {
      if (sort === "newest") {
        const timeDiff = safeNum(b.lastUpdatedTimestamp) - safeNum(a.lastUpdatedTimestamp);
        return timeDiff !== 0 ? timeDiff : String(b.id).localeCompare(String(a.id));
      }
      if (sort === "endingSoon") return safeNum(a.deadline) - safeNum(b.deadline);
      if (sort === "bigPrize") {
        const A = BigInt(a.winningPot || "0"),
          B = BigInt(b.winningPot || "0");
        return A === B ? 0 : A > B ? -1 : 1;
      }
      return 0;
    });
  }, [items, q, status, sort, openOnly, myRafflesOnly, me]);

  const resetFilters = () => {
    setQ("");
    setStatus("ALL");
    setSort("newest");
    setOpenOnly(false);
    setMyRafflesOnly(false);
  };

  const refresh = () => {
    cacheRef.current = null;
    backoffStepRef.current = 0;
    fetchData(false);
  };

  return {
    state: { items, list, note, q, status, sort, openOnly, myRafflesOnly, me },
    actions: {
      setQ,
      setStatus,
      setSort,
      setOpenOnly,
      setMyRafflesOnly,
      resetFilters,
      refresh,
    },
    meta: { totalCount: items?.length || 0, shownCount: list.length, isLoading },
  };
}