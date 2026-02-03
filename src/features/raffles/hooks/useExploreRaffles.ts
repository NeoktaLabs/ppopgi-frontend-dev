// src/hooks/useExploreRaffles.ts
import { useCallback, useEffect, useState } from "react";
import type { RaffleListItem } from "../../../shared/lib/indexer/subgraph";
import { fetchRafflesFromSubgraph } from "../../../shared/lib/indexer/subgraph";
import { fetchRafflesOnChainFallback } from "../../../shared/lib/onchain/fallbackRaffles";

type Mode = "indexer" | "live";

export function useExploreRaffles(limit = 500) {
  const [items, setItems] = useState<RaffleListItem[] | null>(null);
  const [mode, setMode] = useState<Mode>("indexer");
  const [note, setNote] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((x) => x + 1), []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      // Clean refetch UX
      setNote(null);
      // Optional: uncomment if you want Explore to visually "reload" on refetch
      // setItems(null);

      // 1) indexer-first (with timeout)
      let t: number | null = null;
      try {
        t = window.setTimeout(() => controller.abort(), 4500);

        const data = await fetchRafflesFromSubgraph({ signal: controller.signal });

        if (t) window.clearTimeout(t);
        t = null;

        if (!alive) return;

        setMode("indexer");
        setNote(null);

        // Explore: newest first (best effort)
        const sorted = [...data].sort((a, b) => {
          const A = Number(a.lastUpdatedTimestamp || "0");
          const B = Number(b.lastUpdatedTimestamp || "0");
          return B - A;
        });

        setItems(sorted.slice(0, limit));
        return;
      } catch {
        if (t) window.clearTimeout(t);
        t = null;
        // fall through to live fallback
      }

      // 2) fallback: on-chain reads
      try {
        if (!alive) return;
        setMode("live");
        setNote("Showing live data. This may take a moment.");

        const data = await fetchRafflesOnChainFallback(Math.min(limit, 200));
        if (!alive) return;

        // Keep Explore consistent: "newest-ish first"
        // Fallback doesn't have lastUpdatedTimestamp reliably, so we keep the order returned
        // (fallback loads newest registry entries first). Still safe to slice:
        setItems(data.slice(0, limit));
      } catch {
        if (!alive) return;
        setNote("Could not load raffles right now. Please refresh.");
        setItems([]);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [refreshKey, limit]);

  return { items, mode, note, refetch };
}