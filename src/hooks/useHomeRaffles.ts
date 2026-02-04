// src/hooks/useHomeRaffles.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { fetchRafflesFromSubgraph } from "../indexer/subgraph";
import { fetchRafflesOnChainFallback } from "../onchain/fallbackRaffles";

type Mode = "indexer" | "live";

function numOr0(v?: string | null) {
  const n = Number(v || "0");
  return Number.isFinite(n) ? n : 0;
}

export function useHomeRaffles() {
  const [items, setItems] = useState<RaffleListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true); // ✅ Added explicit loading state
  const [mode, setMode] = useState<Mode>("indexer");
  const [note, setNote] = useState<string | null>(null);

  // Core Fetch Logic
  const fetchData = useCallback(async (isBackground = false) => {
    // Only show spinner on first load
    if (!isBackground) setIsLoading(true);
    
    const controller = new AbortController();

    // 1) Try Subgraph (Fast)
    try {
      // Short timeout for indexer
      const t = window.setTimeout(() => controller.abort(), 4500);
      const data = await fetchRafflesFromSubgraph({ signal: controller.signal });
      window.clearTimeout(t);

      setMode("indexer");
      setNote(null);
      setItems(data);
    } catch (err) {
      // 2) Fallback: On-Chain (Slow)
      // Only attempt fallback on the FIRST load.
      // We don't want to spam RPCs in the background every 5s.
      if (!isBackground) {
        try {
          setMode("live");
          setNote("Indexer unavailable. Showing live blockchain data.");
          const data = await fetchRafflesOnChainFallback(50); // Limit to 50 for speed
          setItems(data);
        } catch (fallbackErr) {
          console.error("Fallback failed", fallbackErr);
          if (!items) setItems([]); // Only clear if we have nothing
          setNote("Could not load raffles. Please refresh.");
        }
      } else {
        // If background refresh fails, just do nothing (keep old data)
        console.warn("Background refresh failed, keeping stale data");
      }
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [items]);

  // Initial Load + Polling
  useEffect(() => {
    // 1. Initial Load
    fetchData(false);

    // 2. Silent Polling (every 10 seconds)
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // --- Derived Data Filters (Memoized for performance) ---

  const all = useMemo(() => items ?? [], [items]);

  const active = useMemo(() => {
    return all.filter((r) => r.status === "OPEN" || r.status === "FUNDING_PENDING");
  }, [all]);

  // Big prizes: top 3 active by winningPot (descending)
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

  // Ending soon: top 5 OPEN by deadline ascending
  const endingSoon = useMemo(() => {
    return [...active]
      .filter((r) => r.status === "OPEN")
      .sort((a, b) => numOr0(a.deadline) - numOr0(b.deadline))
      .slice(0, 5);
  }, [active]);

  // Recently finalized
  const recentlyFinalized = useMemo(() => {
    if (mode === "live") return [];
    const settled = all.filter((r) => r.status === "COMPLETED");
    return [...settled]
      .sort((a, b) => {
        const aKey = numOr0(a.completedAt) || numOr0(a.finalizedAt) || numOr0(a.lastUpdatedTimestamp);
        const bKey = numOr0(b.completedAt) || numOr0(b.finalizedAt) || numOr0(b.lastUpdatedTimestamp);
        return bKey - aKey;
      })
      .slice(0, 5);
  }, [all, mode]);

  return { 
    items, 
    bigPrizes, 
    endingSoon, 
    recentlyFinalized, 
    mode, 
    note, 
    isLoading, // ✅ Now properly exported
    refetch: () => fetchData(false) // Manual refresh triggers spinner
  };
}
