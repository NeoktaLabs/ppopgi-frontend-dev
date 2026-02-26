// src/hooks/useLotteryParticipants.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchUserLotteriesByLottery, type UserLotteryItem } from "../indexer/subgraph";

export type ParticipantUI = UserLotteryItem & {
  percentage: string;
};

// --- lightweight in-memory cache (per page load) ---
type CacheEntry = {
  at: number;
  data: UserLotteryItem[];
  soldAtFetch: number; // helps decide if cache is too stale
};

const CACHE = new Map<string, CacheEntry>();

// How long we reuse cached participants to avoid hammering the indexer
const CACHE_TTL_MS = 30_000;

// Optional: if sold has moved materially since last fetch, refetch even within TTL
const SOLD_DELTA_FORCE_REFRESH = 10;

function isAbortError(err: any) {
  const name = String(err?.name ?? "");
  const msg = String(err?.message ?? err ?? "");
  return name === "AbortError" || msg.toLowerCase().includes("aborted");
}

function isHidden() {
  try {
    return typeof document !== "undefined" && document.hidden;
  } catch {
    return false;
  }
}

function normId(v: string) {
  const s = String(v || "").toLowerCase();
  if (!s) return s;
  return s.startsWith("0x") ? s : `0x${s}`;
}

function gt0(v: any): boolean {
  try {
    return BigInt(v ?? "0") > 0n;
  } catch {
    return false;
  }
}

/**
 * Participants = userLotteries(where: { lottery: <id> }, orderBy: ticketsPurchased desc)
 * This is your "holders" list.
 *
 * ✅ Fix: exclude "zero-ticket" rows (e.g. creator/feeRecipient rollup rows that exist
 * in your subgraph but don't represent ticket holders). This prevents showing the creator
 * address with 0 tickets in the Holders tab.
 */
export function useLotteryParticipants(lotteryId: string | null, totalSold: number) {
  const [raw, setRaw] = useState<UserLotteryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (opts?: { force?: boolean; reason?: "id_change" | "revalidate" | "manual" }) => {
      if (!lotteryId) {
        setRaw([]);
        return;
      }

      const key = normId(lotteryId);
      const now = Date.now();
      const soldNow = Number.isFinite(totalSold) ? totalSold : 0;

      // 1) Cache hit (unless force)
      const cached = CACHE.get(key);

      const cacheFresh = !!cached && now - cached.at < CACHE_TTL_MS;

      const soldMovedALot =
        !!cached &&
        Number.isFinite(cached.soldAtFetch) &&
        Math.abs(soldNow - cached.soldAtFetch) >= SOLD_DELTA_FORCE_REFRESH;

      // If not forced and cache is fresh and sold hasn't moved much, use it
      if (!opts?.force && cached && cacheFresh && !soldMovedALot) {
        setRaw(cached.data);
        return;
      }

      // 2) Abort any in-flight request
      try {
        abortRef.current?.abort();
      } catch {}
      const ac = new AbortController();
      abortRef.current = ac;

      // Only show spinner if we truly have nothing to show
      const hasSomething = (cached?.data?.length ?? raw.length) > 0;
      if (!hasSomething) setIsLoading(true);

      try {
        const data = await fetchUserLotteriesByLottery(key, { first: 1000, signal: ac.signal });
        if (ac.signal.aborted) return;

        // ✅ Filter out non-holders (0 ticketsPurchased)
        const cleaned = (data ?? []).filter((p) => gt0((p as any)?.ticketsPurchased));

        CACHE.set(key, { at: now, data: cleaned, soldAtFetch: soldNow });
        setRaw(cleaned);
      } catch (err: any) {
        if (isAbortError(err)) return;

        // Keep showing cached/previous data on error (don’t blank the list)
        console.error("Failed to load participants", err);

        if (cached?.data?.length) setRaw(cached.data);
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    },
    [lotteryId, totalSold, raw.length]
  );

  // Fetch when lotteryId changes
  useEffect(() => {
    if (!lotteryId) {
      setRaw([]);
      return;
    }

    void load({ force: false, reason: "id_change" });

    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, [lotteryId, load]);

  // Refresh holders after buy/create (ppopgi:revalidate)
  useEffect(() => {
    const onRevalidate = () => {
      if (!lotteryId) return;
      if (isHidden()) return;

      void load({ force: false, reason: "revalidate" });
    };

    window.addEventListener("ppopgi:revalidate", onRevalidate as any);
    return () => window.removeEventListener("ppopgi:revalidate", onRevalidate as any);
  }, [lotteryId, load]);

  // Recompute percentages locally when totalSold changes (no refetch)
  const participants: ParticipantUI[] = useMemo(() => {
    const sold = Number.isFinite(totalSold) ? totalSold : 0;

    // If indexer lags and sold is 0, avoid weird %.
    const denom = sold > 0 ? sold : 0;

    return (raw ?? []).map((p) => {
      const count = Number((p as any)?.ticketsPurchased || "0");
      const pct = denom > 0 ? ((count / denom) * 100).toFixed(1) : "0.0";
      return { ...p, percentage: pct };
    });
  }, [raw, totalSold]);

  return {
    participants,
    isLoading,
    refresh: () => load({ force: true, reason: "manual" }),
  };
}