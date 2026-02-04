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
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("indexer");
  const [note, setNote] = useState<string | null>(null);

  // ✅ FIX: Removed [items] dependency to prevent infinite loop
  const fetchData = useCallback(async (isBackground = false) => {
    // Only show spinner on first load
    if (!isBackground) setIsLoading(true);
    
    const controller = new AbortController();

    try {
      // 1) Try Subgraph (Fast)
      const t = window.setTimeout(() => controller.abort(), 4500);
      const data = await fetchRafflesFromSubgraph({ signal: controller.signal });
      window.clearTimeout(t);

      setMode("indexer");
      setNote(null);
      setItems(data);
    } catch (err) {
      // 2) Fallback: On-Chain (Only on first load, not background)
      if (!isBackground) {
        try {
          setMode("live");
          setNote("Indexer unavailable. Showing live blockchain data.");
          const data = await fetchRafflesOnChainFallback(50);
          setItems(data);
        } catch (fallbackErr) {
          console.error("Fallback failed", fallbackErr);
          // Don't clear items if we fail in background, keep old data
          if (!isBackground) setNote("Could not load raffles. Please refresh.");
        }
      }
    } finally {
      // ✅ FIX: Only turn off loading if this wasn't a background refresh
      if (!isBackground) setIsLoading(false);
    }
  }, []); // ✅ Dependency array must be empty!

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

  // --- Derived Data Filters ---

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
    isLoading, 
    refetch: () => fetchData(false) 
  };
}
