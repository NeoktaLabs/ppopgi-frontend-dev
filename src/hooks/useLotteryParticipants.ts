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
  soldAtFetch: number;
};

const CACHE = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 30_000;
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

/**
 * Participants = userLotteries(where: { lottery: <id> }, orderBy: ticketsPurchased desc)
 */
export function useLotteryParticipants(lotteryId: string | null, totalSold: number) {
  const [raw, setRaw] = useState<UserLotteryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(
    async (opts?: { force?: boolean; reason?: "id_change" | "revalidate" | "manual" }) => {
      if (!lotteryId) {
        setRaw([]);
        setIsLoading(false);
        return;
      }

      const key = lotteryId.toLowerCase();
      const now = Date.now();
      const soldNow = Number.isFinite(totalSold) ? totalSold : 0;

      const cached = CACHE.get(key);
      const cacheFresh = !!cached && now - cached.at < CACHE_TTL_MS;

      const soldMovedALot =
        !!cached &&
        Number.isFinite(cached.soldAtFetch) &&
        Math.abs(soldNow - cached.soldAtFetch) >= SOLD_DELTA_FORCE_REFRESH;

      if (!opts?.force && cached && cacheFresh && !soldMovedALot) {
        setRaw(cached.data);
        setIsLoading(false);
        return;
      }

      // Abort previous request
      try {
        abortRef.current?.abort();
      } catch {}

      const ac = new AbortController();
      abortRef.current = ac;

      const myReqId = ++reqIdRef.current;

      // Spinner only if we truly have nothing to show
      const hasSomething = (cached?.data?.length ?? raw.length) > 0;
      if (!hasSomething) setIsLoading(true);

      try {
        const data = await fetchUserLotteriesByLottery(key, { first: 1000, signal: ac.signal });

        // Only the latest request is allowed to update state
        if (ac.signal.aborted || myReqId !== reqIdRef.current) return;

        CACHE.set(key, { at: now, data: data ?? [], soldAtFetch: soldNow });
        setRaw(data ?? []);
      } catch (err: any) {
        if (isAbortError(err)) return;

        console.error("Failed to load participants", err);

        // Keep cached/previous data on error
        if (cached?.data?.length) setRaw(cached.data);
      } finally {
        // Only the latest request should control loading state
        if (myReqId === reqIdRef.current) setIsLoading(false);
      }
    },
    [lotteryId, totalSold, raw.length]
  );

  // Fetch when lotteryId changes
  useEffect(() => {
    if (!lotteryId) {
      setRaw([]);
      setIsLoading(false);
      return;
    }

    void load({ force: false, reason: "id_change" });

    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, [lotteryId, load]);

  // Refresh holders after buy/create
  useEffect(() => {
    const onRevalidate = () => {
      if (!lotteryId) return;
      if (isHidden()) return;
      void load({ force: false, reason: "revalidate" });
    };

    window.addEventListener("ppopgi:revalidate", onRevalidate as any);
    return () => window.removeEventListener("ppopgi:revalidate", onRevalidate as any);
  }, [lotteryId, load]);

  const participants: ParticipantUI[] = useMemo(() => {
    const sold = Number.isFinite(totalSold) ? totalSold : 0;

    return (raw ?? [])
      // optional safety: ignore zero-ticket rows
      .filter((p) => Number(p.ticketsPurchased || "0") > 0)
      .map((p) => {
        const count = Number(p.ticketsPurchased || "0");
        const pct = sold > 0 ? ((count / sold) * 100).toFixed(1) : "0.0";
        return { ...p, percentage: pct };
      });
  }, [raw, totalSold]);

  return {
    participants,
    isLoading,
    refresh: () => load({ force: true, reason: "manual" }),
  };
}