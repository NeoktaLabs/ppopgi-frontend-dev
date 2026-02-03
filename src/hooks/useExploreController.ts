// src/hooks/useExploreController.ts
import { useState, useMemo } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useExploreRaffles } from "./useExploreRaffles";
import type { RaffleStatus } from "../indexer/subgraph";

export type SortMode = "endingSoon" | "bigPrize" | "newest";

// Helper functions
const norm = (s: string) => (s || "").trim().toLowerCase();
const safeNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const isActiveStatus = (s: RaffleStatus) => s === "OPEN" || s === "FUNDING_PENDING";

export function useExploreController() {
  const { items, note } = useExploreRaffles(500);
  const activeAccount = useActiveAccount();
  const me = activeAccount?.address ? norm(activeAccount.address) : null;

  // --- Filter States ---
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RaffleStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortMode>("endingSoon");
  const [openOnly, setOpenOnly] = useState(false);
  const [myRafflesOnly, setMyRafflesOnly] = useState(false);

  // --- The Heavy Logic ---
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
      if (sort === "endingSoon") return safeNum(a.deadline) - safeNum(b.deadline);
      if (sort === "bigPrize") {
        const A = BigInt(a.winningPot || "0"), B = BigInt(b.winningPot || "0");
        return A === B ? 0 : A > B ? -1 : 1;
      }
      // "newest"
      const timeDiff = safeNum(b.lastUpdatedTimestamp) - safeNum(a.lastUpdatedTimestamp);
      return timeDiff !== 0 ? timeDiff : String(a.id).localeCompare(String(b.id));
    });
  }, [items, q, status, sort, openOnly, myRafflesOnly, me]);

  const resetFilters = () => {
    setQ(""); setStatus("ALL"); setSort("endingSoon");
    setOpenOnly(false); setMyRafflesOnly(false);
  };

  return {
    state: { items, list, note, q, status, sort, openOnly, myRafflesOnly, me },
    actions: { setQ, setStatus, setSort, setOpenOnly, setMyRafflesOnly, resetFilters },
    meta: { 
      totalCount: items?.length || 0, 
      shownCount: list.length,
      isLoading: !items 
    }
  };
}
