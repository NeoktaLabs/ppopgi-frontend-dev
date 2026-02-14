// src/hooks/useHomeRaffles.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { fetchRafflesOnChainFallback } from "../onchain/fallbackRaffles";

import { useRaffleStore, refresh as refreshRaffleStore } from "./useRaffleStore";
import { useRevalidate } from "../hooks/useRevalidateTick";

type Mode = "indexer" | "live";

function numOr0(v?: string | null) {
  const n = Number(v || "0");
  return Number.isFinite(n) ? n : 0;
}

function isRateLimitNote(note: string) {
  const s = (note || "").toLowerCase();
  return s.includes("too many requests") || s.includes("rate") || s.includes("429");
}

function shouldFallback(note: string | null) {
  if (!note) return false;
  const s = note.toLowerCase();

  // Only fallback for genuine “indexer down/unreachable” cases.
  // For rate-limits, better to wait/backoff than hammer on-chain + indexer.
  if (isRateLimitNote(note)) return false;

  return (
    s.includes("failed") ||
    s.includes("unavailable") ||
    s.includes("could not") ||
    s.includes("error") ||
    s.includes("timeout")
  );
}

export function useHomeRaffles() {
  // ✅ Shared store snapshot (indexer)
  const store = useRaffleStore("home", 20_000);

  // ✅ Revalidate tick (event-based refresh)
  const rvTick = useRevalidate();

  // Local override (live fallback)
  const [mode, setMode] = useState<Mode>("indexer");
  const [note, setNote] = useState<string | null>(null);
  const [liveItems, setLiveItems] = useState<RaffleListItem[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  // Prevent hammering live fallback
  const lastLiveAtRef = useRef<number>(0);
  const LIVE_CACHE_MS = 20_000;

  // Prevent hammering indexer revalidations (even if multiple events fire)
  const lastRvAtRef = useRef<number>(0);
  const RV_MIN_GAP_MS = 3_000;

  // Store-derived state
  const indexerItems = store.items ?? null;
  const isIndexerLoading = !!store.isLoading;
  const indexerNote = store.note ?? null;

  /**
   * ✅ Soft refresh (used for global revalidate ticks):
   * - refreshes the shared store
   * - does NOT reset mode/live/note (prevents UI "snapping")
   */
  const softRefetch = useCallback(() => {
    void refreshRaffleStore(true, true);
  }, []);

  /**
   * ✅ Hard/manual refetch (user-driven):
   * - clears live mode and forces indexer attempt
   */
  const refetch = useCallback(() => {
    setLiveItems(null);
    setLiveLoading(false);
    setMode("indexer");
    setNote(null);
    void refreshRaffleStore(false, true);
  }, []);

  // ✅ Background refresh on revalidate tick (throttled) — use soft refresh to avoid UI snapping
  useEffect(() => {
    if (!rvTick) return;

    const now = Date.now();
    if (now - lastRvAtRef.current < RV_MIN_GAP_MS) return;
    lastRvAtRef.current = now;

    softRefetch();
  }, [rvTick, softRefetch]);

  // If we have indexer data, always prefer it and exit live mode
  useEffect(() => {
    if (indexerItems && indexerItems.length > 0) {
      setMode("indexer");
      setNote(null);
      setLiveItems(null);
      setLiveLoading(false);
    }
  }, [indexerItems]);

  // If indexer is rate-limited, surface the note but do NOT flip to live
  useEffect(() => {
    if (indexerNote && isRateLimitNote(indexerNote)) {
      setNote(indexerNote);
    }
  }, [indexerNote]);

  // Fallback trigger (only when indexer has no data AND looks down, and only occasionally)
  useEffect(() => {
    const canTry =
      !isIndexerLoading &&
      (!indexerItems || indexerItems.length === 0) &&
      shouldFallback(indexerNote);

    if (!canTry) {
      // if store has an error note, show it (but don't constantly overwrite)
      if (indexerNote && !isRateLimitNote(indexerNote)) setNote(indexerNote);
      return;
    }

    const now = Date.now();
    if (now - lastLiveAtRef.current < LIVE_CACHE_MS) {
      setMode("live");
      setNote("Indexer unavailable. Showing live blockchain data.");
      return;
    }

    lastLiveAtRef.current = now;
    setLiveLoading(true);
    setMode("live");
    setNote("Indexer unavailable. Showing live blockchain data.");

    fetchRafflesOnChainFallback(50)
      .then((data) => setLiveItems(data))
      .catch((e) => {
        console.error("Home fallback failed", e);
        setNote("Could not load raffles. Please refresh.");
      })
      .finally(() => setLiveLoading(false));
  }, [indexerItems, isIndexerLoading, indexerNote]);

  // Final items/loading state exposed to UI
  const items: RaffleListItem[] | null = mode === "live" ? liveItems : indexerItems;
  const isLoading = mode === "live" ? liveLoading : isIndexerLoading;

  // ----------------- Derived lists -----------------
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

  /**
   * ✅ Recently Finalized (Settled + Canceled)
   * - Indexer only (live mode returns [])
   * - Sorted by the most recent "final action" timestamp we can find:
   *   completedAt -> finalizedAt -> lastUpdatedTimestamp
   * - Shows the 5 most recent
   */
  const recentlyFinalized = useMemo(() => {
    if (mode === "live") return [];

    const finalized = all.filter((r) => r.status === "COMPLETED" || r.status === "CANCELED");

    return [...finalized]
      .sort((a, b) => {
        const aKey =
          numOr0((a as any).completedAt) ||
          numOr0((a as any).finalizedAt) ||
          numOr0((a as any).lastUpdatedTimestamp);

        const bKey =
          numOr0((b as any).completedAt) ||
          numOr0((b as any).finalizedAt) ||
          numOr0((b as any).lastUpdatedTimestamp);

        return bKey - aKey;
      })
      .slice(0, 5);
  }, [all, mode]);

  const stats = useMemo(() => {
    const totalRaffles = all.length;

    const settledVolume = all.reduce((acc, r) => {
      if (r.status === "COMPLETED") return acc + BigInt(r.winningPot || "0");
      return acc;
    }, 0n);

    const activeVolume = active.reduce((acc, r) => acc + BigInt(r.winningPot || "0"), 0n);

    return { totalRaffles, settledVolume, activeVolume };
  }, [all, active]);

  return {
    items,
    bigPrizes,
    endingSoon,
    recentlyFinalized,
    stats,
    mode,
    note,
    isLoading,
    refetch, // manual/hard refresh
  };
}