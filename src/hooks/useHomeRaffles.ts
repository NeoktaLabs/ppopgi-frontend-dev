la// src/hooks/useHomeRaffles.ts
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

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    
    const controller = new AbortController();

    try {
      const t = window.setTimeout(() => controller.abort(), 4500);
      const data = await fetchRafflesFromSubgraph({ signal: controller.signal });
      window.clearTimeout(t);

      setMode("indexer");
      setNote(null);
      setItems(data);
    } catch (err) {
      if (!isBackground) {
        try {
          setMode("live");
          setNote("Indexer unavailable. Showing live blockchain data.");
          const data = await fetchRafflesOnChainFallback(50);
          setItems(data);
        } catch (fallbackErr) {
          console.error("Fallback failed", fallbackErr);
          if (!isBackground) setNote("Could not load raffles. Please refresh.");
        }
      }
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false); 
    const interval = setInterval(() => { fetchData(true); }, 10000);
    return () => clearInterval(interval);
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
    const settled = all.filter((r) => r.status === "COMPLETED";
    return [...settled]
      .sort((a, b) => {
        const aKey = numOr0(a.completedAt) || numOr0(a.finalizedAt) || numOr0(a.lastUpdatedTimestamp);
        const bKey = numOr0(b.completedAt) || numOr0(b.finalizedAt) || numOr0(b.lastUpdatedTimestamp);
        return bKey - aKey;
      })
      .slice(0, 5);
  }, [all, mode]);

  // ✅ NEW STATS LOGIC
  const stats = useMemo(() => {
    const totalRaffles = all.length;
    
    // 1. Settled Volume (Sum of pot for completed raffles)
    const settledVolume = all.reduce((acc, r) => {
        if (r.status === "COMPLETED" {
            return acc + BigInt(r.winningPot || "0");
        }
        return acc;
    }, 0n);

    // 2. Active Volume (TVL - Sum of pot for Open raffles)
    const activeVolume = active.reduce((acc, r) => {
        return acc + BigInt(r.winningPot || "0");
    }, 0n);

    return { totalRaffles, settledVolume, activeVolume };
  }, [all, active]);

  return { 
    items, bigPrizes, endingSoon, recentlyFinalized, 
    stats, // Exported stats
    mode, note, isLoading, 
    refetch: () => fetchData(false) 
  };
}
