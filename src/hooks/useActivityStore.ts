// src/hooks/useActivityStore.ts
import { useEffect, useMemo, useState } from "react";
import { fetchGlobalActivity, type GlobalActivityItem } from "../indexer/subgraph";
import { refresh as refreshRaffleStore } from "./useRaffleStore";

type LocalActivityItem = GlobalActivityItem & {
  pending?: boolean;
  pendingLabel?: string;
};

const DEFAULT_REFRESH_MS = 5_000; // used for manual refresh + backoff calc
const MAX_ITEMS = 10;

// ✅ Safety poll only (prevents the store from having its own 5s loop)
const SAFETY_POLL_MS = 60_000;

// After a user action, try a small "force-fresh" burst to converge quickly
// (assumes indexer is up to date or nearly so).
const FORCE_FRESH_BURST_MS = [1_000, 2_000, 3_000];

function isHidden() {
  try {
    return typeof document !== "undefined" && document.hidden;
  } catch {
    return false;
  }
}

function parseHttpStatus(err: any): number | null {
  const msg = String(err?.message || err || "");
  const m = msg.match(/SUBGRAPH_HTTP_ERROR_(\d{3})/);
  return m ? Number(m[1]) : null;
}

function isRateLimitError(err: any) {
  const status = parseHttpStatus(err);
  if (status === 429 || status === 503) return true;

  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("too many requests") || msg.includes("rate limit");
}

function getStableItemKey(it: any): string {
  return String(it?.txHash || "");
}

// Support both new and legacy shapes
function getLotteryId(it: any): string {
  return String(it?.lotteryId || it?.raffleId || "");
}
function getLotteryName(it: any): string {
  return String(it?.lotteryName || it?.raffleName || "—");
}

// ---------- module-level singleton store (deduped across app) ----------
type State = {
  items: LocalActivityItem[];
  isLoading: boolean;
  note: string | null;
  lastUpdatedMs: number;
};

let state: State = {
  items: [],
  isLoading: true,
  note: null,
  lastUpdatedMs: 0,
};

let timer: number | null = null;
let inFlight = false;
let backoffStep = 0;
let abortRef: AbortController | null = null;
let started = false;

const subs = new Set<() => void>();

function emit() {
  state = { ...state, lastUpdatedMs: Date.now() };
  subs.forEach((fn) => fn());
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

function clearTimer() {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function schedule(ms: number, refreshMs: number) {
  clearTimer();
  timer = window.setTimeout(() => void load(true, refreshMs), ms);
}

function dispatchRevalidateThrottledFactory() {
  let lastAt = 0;
  return () => {
    const now = Date.now();
    if (now - lastAt < 1_000) return;
    lastAt = now;
    try {
      window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
    } catch {}
  };
}
const dispatchRevalidate = dispatchRevalidateThrottledFactory();

/**
 * forceFresh:
 * - Tells your cache worker to bypass edge cache (x-force-fresh: 1) on this request.
 * - Your fetchGlobalActivity implementation can choose to forward that header.
 *
 * We pass it as an extra option via `as any` so it won’t break older function signatures.
 */
async function load(isBackground: boolean, refreshMs: number, forceFresh = false) {
  if (isBackground && isHidden()) {
    schedule(SAFETY_POLL_MS, refreshMs);
    return;
  }
  if (inFlight) return;
  inFlight = true;

  try {
    abortRef?.abort();
  } catch {}
  const ac = new AbortController();
  abortRef = ac;

  try {
    if (state.items.length === 0) setState({ isLoading: true });

    const data = await fetchGlobalActivity({ first: MAX_ITEMS, signal: ac.signal, forceFresh } as any);
    if (ac.signal.aborted) return;

    const real = (data ?? []) as LocalActivityItem[];

    // Dedup logic based on txHash (stable) and keep optimistic items until they appear in real feed
    const prevRealHashes = new Set(state.items.filter((x) => !x.pending).map((x) => x.txHash));
    const nextRealHashes = new Set(real.map((x) => x.txHash));

    let hasNew = false;
    for (const h of nextRealHashes) {
      if (h && !prevRealHashes.has(h)) {
        hasNew = true;
        break;
      }
    }

    setState({
      items: (() => {
        const pending = state.items.filter((x) => x.pending);
        const realHashes = new Set(real.map((x) => x.txHash));
        const stillPending = pending.filter((p) => !realHashes.has(p.txHash));
        return [...stillPending, ...real].slice(0, MAX_ITEMS);
      })(),
      isLoading: false,
      note: null,
    });

    backoffStep = 0;

    // No fast polling loop here; keep only a slow safety poll.
    schedule(SAFETY_POLL_MS, refreshMs);

    if (hasNew) {
      dispatchRevalidate();
      void refreshRaffleStore(true, true);
    }
  } catch (e: any) {
    if (String(e?.name || "").toLowerCase().includes("abort")) return;
    if (String(e).toLowerCase().includes("abort")) return;

    console.error("[useActivityStore] load failed", e);

    setState({ isLoading: false });

    if (isRateLimitError(e)) {
      backoffStep = Math.min(backoffStep + 1, 5);
      const delays = [10_000, 15_000, 30_000, 60_000, 120_000, 120_000];
      schedule(delays[backoffStep], refreshMs);
    } else {
      schedule(isBackground ? 15_000 : 10_000, refreshMs);
    }
  } finally {
    inFlight = false;
  }
}

function triggerForceFreshBurst(refreshMs: number) {
  for (const ms of FORCE_FRESH_BURST_MS) {
    window.setTimeout(() => {
      // background + forceFresh
      void load(true, refreshMs, true);
    }, ms);
  }
}

function start(refreshMs: number) {
  if (started) return;
  started = true;

  void load(false, refreshMs);

  const onOptimistic = (ev: Event) => {
    const d = (ev as CustomEvent).detail as Partial<LocalActivityItem> | null;
    if (!d?.txHash) return;

    const now = Math.floor(Date.now() / 1000);

    // Support both new + legacy payloads from the optimistic event
    const lotteryId = String((d as any).lotteryId ?? (d as any).raffleId ?? "");
    const lotteryName = String((d as any).lotteryName ?? (d as any).raffleName ?? "Pending...");

    const item: LocalActivityItem = {
      type: (d.type as any) ?? "BUY",
      // keep legacy fields if present; UI reads both
      ...(d as any),
      lotteryId,
      lotteryName,

      subject: String((d as any).subject ?? "0x"),
      value: String((d as any).value ?? "0"),
      timestamp: String((d as any).timestamp ?? now),
      txHash: String(d.txHash),
      pending: true,
      pendingLabel: (d as any).pendingLabel ? String((d as any).pendingLabel) : "Pending",
    } as any;

    setState({
      items: [item, ...state.items.filter((x) => x.txHash !== item.txHash)].slice(0, MAX_ITEMS),
    });

    dispatchRevalidate();
    void refreshRaffleStore(true, true);

    // ✅ try to converge to subgraph within 1–3s if indexer is up to date
    triggerForceFreshBurst(refreshMs);
  };

  window.addEventListener("ppopgi:activity", onOptimistic as any);

  // focus/visibility refresh (helps even without global tick)
  const onFocus = () => void load(true, refreshMs);
  const onVis = () => {
    if (!isHidden()) void load(true, refreshMs);
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVis);
}

export function useActivityStore(refreshMs = DEFAULT_REFRESH_MS) {
  const [, force] = useState(0);

  useEffect(() => {
    start(refreshMs);
    const sub = () => force((x) => x + 1);
    subs.add(sub);
    return () => {
      subs.delete(sub);
    };
  }, [refreshMs]);

  return useMemo(
    () => ({
      items: state.items,
      isLoading: state.isLoading,
      note: state.note,
      lastUpdatedMs: state.lastUpdatedMs,
      refresh: () => void load(false, refreshMs),
      refreshForceFresh: () => void load(false, refreshMs, true),
    }),
    [refreshMs, state.lastUpdatedMs]
  );
}

// ✅ module-level refresh for GlobalDataRefresher / others
export function refresh(background = true, _force = true, refreshMs = DEFAULT_REFRESH_MS) {
  start(refreshMs);
  return load(background, refreshMs);
}

// Optional: module-level “fast refresh” that bypasses cache worker
export function refreshForceFresh(background = true, refreshMs = DEFAULT_REFRESH_MS) {
  start(refreshMs);
  return load(background, refreshMs, true);
}