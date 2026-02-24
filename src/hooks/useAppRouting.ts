// src/hooks/useAppRouting.ts
import { useEffect, useState, useCallback } from "react";

function extractAddress(input: string): string | null {
  const m = (input || "").match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0].toLowerCase() : null;
}

function readSelectedLotteryIdFromUrl(): { id: string | null; source: "lottery" | "raffle" | null } {
  try {
    const url = new URL(window.location.href);

    const fromLottery = extractAddress(url.searchParams.get("lottery") || "");
    if (fromLottery) return { id: fromLottery, source: "lottery" };

    const fromRaffle = extractAddress(url.searchParams.get("raffle") || "");
    if (fromRaffle) return { id: fromRaffle, source: "raffle" };

    return { id: null, source: null };
  } catch {
    return { id: null, source: null };
  }
}

export function useAppRouting() {
  const [selectedLotteryId, setSelectedLotteryId] = useState<string | null>(null);

  const syncFromUrl = useCallback(() => {
    const { id, source } = readSelectedLotteryIdFromUrl();
    setSelectedLotteryId(id);

    // ✅ Auto-migrate old links: ?raffle=0x.. -> ?lottery=0x..
    if (id && source === "raffle") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("raffle");
        url.searchParams.set("lottery", id);
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
  }, []);

  // Sync URL -> State (back/forward)
  useEffect(() => {
    syncFromUrl();

    const onPop = () => syncFromUrl();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [syncFromUrl]);

  // Sync State -> URL
  const openLottery = useCallback((id: string) => {
    const addr = (extractAddress(id) ?? id).toLowerCase();
    setSelectedLotteryId(addr);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lottery", addr);
      url.searchParams.delete("raffle"); // ✅ ensure canonical param
      window.history.pushState({}, "", url.toString());
    } catch {}
  }, []);

  const closeLottery = useCallback(() => {
    setSelectedLotteryId(null);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("lottery"); // ✅ don't wipe other params
      url.searchParams.delete("raffle");  // ✅ clean legacy too
      window.history.pushState({}, "", url.toString());
    } catch {}
  }, []);

  return { selectedLotteryId, openLottery, closeLottery };
}