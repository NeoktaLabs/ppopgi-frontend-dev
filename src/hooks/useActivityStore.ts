import { useEffect, useMemo, useState } from "react";
import { fetchGlobalActivity, type GlobalActivityItem } from "../indexer/subgraph";
import { refresh as refreshRaffleStore } from "./useRaffleStore";

type LocalActivityItem = GlobalActivityItem & { pending?: boolean; pendingLabel?: string };

const DEFAULT_REFRESH_MS = 5_000;
const MAX_ITEMS = 10;

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
    if (now - lastAt < 1_000) return; // avoid spam
    lastAt = now;
    try {
      window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
    } catch {}
  };
}
const dispatchRevalidate = dispatchRevalidateThrottledFactory();

async function load(isBackground: boolean, refreshMs: number) {
  if (isBackground && isHidden()) {
    schedule(60_000, refreshMs);
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

    const data = await fetchGlobalActivity({ first: MAX_ITEMS, signal: ac.signal });
    if (ac.signal.aborted) return;

    const real = (data ?? []) as LocalActivityItem[];

    // Detect "new" real activity (new txHash not previously present in real items)
    const prevRealHashes = new Set(state.items.filter((x) => !x.pending).map((x) => x.txHash));
    const nextRealHashes = new Set(real.map((x) => x.txHash));
    let hasNew = false;
    for (const h of nextRealHashes) {
      if (h && !prevRealHashes.has(h)) {
        hasNew = true;
        break;
      }
    }

    // Keep optimistic pending items until they appear in real feed
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
    schedule(refreshMs, refreshMs);

    // ✅ GLOBAL SYNC: when new activity appears, refresh the raffle store + revalidate listeners (Home, etc.)
    if (hasNew) {
      dispatchRevalidate();
      // This is deduped by your store anyway; keep it "background-ish"
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

function start(refreshMs: number) {
  if (started) return;
  started = true;

  // initial
  void load(false, refreshMs);

  // optimistic inserts
  const onOptimistic = (ev: Event) => {
    const d = (ev as CustomEvent).detail as Partial<LocalActivityItem> | null;
    if (!d?.txHash) return;

    const now = Math.floor(Date.now() / 1000);
    const item: LocalActivityItem = {
      type: (d.type as any) ?? "BUY",
      raffleId: String(d.raffleId ?? ""),
      raffleName: String(d.raffleName ?? "Pending..."),
      subject: String(d.subject ?? "0x"),
      value: String(d.value ?? "0"),
      timestamp: String(d.timestamp ?? now),
      txHash: String(d.txHash),
      pending: true,
      pendingLabel: d.pendingLabel ? String(d.pendingLabel) : "Pending",
    };

    setState({
      items: [item, ...state.items.filter((x) => x.txHash !== item.txHash)].slice(0, MAX_ITEMS),
    });

    // If we got an optimistic event, it usually means the user did an action.
    // Trigger revalidate soon so other pages get nudged.
    dispatchRevalidate();
    void refreshRaffleStore(true, true);
  };

  window.addEventListener("ppopgi:activity", onOptimistic as any);

  // focus/visibility refresh
  const onFocus = () => void load(true, refreshMs);
  const onVis = () => {
    if (!isHidden()) void load(true, refreshMs);
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVis);

  // cleanup is intentionally omitted because this is a singleton store
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
    }),
    [refreshMs, state.lastUpdatedMs]
  );
}