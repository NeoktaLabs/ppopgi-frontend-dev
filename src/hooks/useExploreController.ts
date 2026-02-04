// src/hooks/useExploreController.ts
import { useState, useMemo, useEffect, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import { fetchRafflesFromSubgraph, type RaffleListItem, type RaffleStatus } from "../indexer/subgraph";

export type SortMode = "endingSoon" | "bigPrize" | "newest";

const norm = (s: string) => (s || "").trim().toLowerCase();
const safeNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const isActiveStatus = (s: RaffleStatus) => s === "OPEN" || s === "FUNDING_PENDING";

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

  // --- 1. Silent Data Fetch ---
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);

    try {
      const data = await fetchRafflesFromSubgraph({ first: 1000 });
      setItems(data);
      setNote(null);
    } catch (e) {
      console.error("Explore fetch failed", e);
      if (!isBackground) setNote("Failed to load raffles.");
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  // --- 2. Polling Effect ---
  useEffect(() => {
    fetchData(false); // First load

    const interval = setInterval(() => {
      fetchData(true); // Background update
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // --- 3. Filtering Logic (Memoized) ---
  const list = useMemo(() => {
    const all = items ?? [];
    let filtered = status === "ALL" ? all : all.filter((r) => r.status === status);

    if (openOnly) filtered = filtered.filter((r) => isActiveStatus(r.status));
    
    if (myRafflesOnly && me) {
      filtered = filtered.filter((r: any) => (r.creator ? norm(String(r.creator)) : null) === me);
    }

    const query = norm(q);
    if (query) {
      filtered = filtered.filter((r) => `${r.name || ""} ${r.id || ""}`.toLowerCase().includes(query));
    }

    return filtered.sort((a, b) => {
      if (sort === "newest") {
        const timeDiff = safeNum(b.lastUpdatedTimestamp) - safeNum(a.lastUpdatedTimestamp);
        return timeDiff !== 0 ? timeDiff : String(b.id).localeCompare(String(a.id));
      }
      if (sort === "endingSoon") return safeNum(a.deadline) - safeNum(b.deadline);
      if (sort === "bigPrize") {
        const A = BigInt(a.winningPot || "0"), B = BigInt(b.winningPot || "0");
        return A === B ? 0 : A > B ? -1 : 1;
      }
      return 0;
    });
  }, [items, q, status, sort, openOnly, myRafflesOnly, me]);

  const resetFilters = () => {
    setQ(""); setStatus("ALL"); setSort("newest");
    setOpenOnly(false); setMyRafflesOnly(false);
  };

  return {
    state: { items, list, note, q, status, sort, openOnly, myRafflesOnly, me },
    actions: { setQ, setStatus, setSort, setOpenOnly, setMyRafflesOnly, resetFilters, refresh: () => fetchData(false) },
    meta: { totalCount: items?.length || 0, shownCount: list.length, isLoading }
  };
}
