// src/hooks/useRaffleStore.ts
import { fetchRafflesFromSubgraph, type RaffleListItem } from "../indexer/subgraph";

/**
 * Shared raffle store
 * - Single indexer poller for the whole app
 * - Dedupes requests
 * - Backs off on 429 / rate limits
 * - Slows down when tab is hidden
 * - Stops polling when unused
 */

type StoreState = {
  items: RaffleListItem[] | null;
  isLoading: boolean;
  note: string | null;
  lastUpdatedMs: number;
  lastErrorMs: number;
};

type Listener = () => void;

const state: StoreState = {
  items: null,
  isLoading: false,
  note: null,
  lastUpdatedMs: 0,
  lastErrorMs: 0,
};

const listeners = new Set<Listener>();

let subscribers = 0;

// Polling control
let timer: number | null = null;
let inFlight: Promise<void> | null = null;
let aborter: AbortController | null = null;

let backoffUntilMs = 0;
let backoffStep = 0;

// Each consumer requests a poll interval; we use the minimum
const requestedPolls = new Map<string, number>();

function emit() {
  listeners.forEach((fn) => fn());
}

function setState(patch: Partial<StoreState>) {
  Object.assign(state, patch);
  emit();
}

function isHidden() {
  try {
    return document.hidden;
  } catch {
    return false;
  }
}

function computePollMs() {
  const minRequested =
    requestedPolls.size > 0 ? Math.min(...requestedPolls.values()) : 20_000;

  const fg = Math.max(10_000, minRequested);
  const bg = Math.max(60_000, fg);

  return isHidden() ? bg : fg;
}

function clearTimer() {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function scheduleNext() {
  clearTimer();
  if (subscribers <= 0) return;

  const now = Date.now();
  const waitForBackoff = Math.max(0, backoffUntilMs - now);
  const delay = waitForBackoff || computePollMs();

  timer = window.setTimeout(() => {
    void refresh(true);
  }, delay);
}

function parseHttpStatus(err: any): number | null {
  const msg = String(err?.message || err || "");
  const m = msg.match(/SUBGRAPH_HTTP_ERROR_(\d{3})/);
  return m ? Number(m[1]) : null;
}

function applyBackoff(err: any) {
  const status = parseHttpStatus(err);
  const rateLimited = status === 429 || status === 503;

  backoffStep = Math.min(backoffStep + 1, rateLimited ? 6 : 3);

  const base = rateLimited ? 10_000 : 5_000;
  const max = rateLimited ? 5 * 60_000 : 60_000;

  const delay = Math.min(max, base * Math.pow(2, backoffStep));
  backoffUntilMs = Date.now() + delay;

  setState({
    note: rateLimited
      ? "Indexer rate-limited. Retrying shortly…"
      : "Indexer temporarily unavailable.",
    lastErrorMs: Date.now(),
  });
}

function resetBackoff() {
  backoffStep = 0;
  backoffUntilMs = 0;
}

async function doFetch(isBackground: boolean) {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    if (!isBackground) setState({ isLoading: true });

    aborter?.abort();
    aborter = new AbortController();

    try {
      const data = await fetchRafflesFromSubgraph({
        first: 1000,
        signal: aborter.signal,
      });

      setState({
        items: data,
        note: null,
        isLoading: false,
        lastUpdatedMs: Date.now(),
      });

      resetBackoff();
    } catch (err) {
      if (!isBackground) setState({ isLoading: false });
      applyBackoff(err);
      console.warn("[useRaffleStore] fetch failed", err);
    } finally {
      inFlight = null;
      scheduleNext();
    }
  })();

  return inFlight;
}

export async function refresh(
  isBackground = false,
  force = false
) {
  if (subscribers <= 0) return;

  if (!force && Date.now() < backoffUntilMs) {
    scheduleNext();
    return;
  }

  if (force) backoffUntilMs = 0;

  await doFetch(isBackground);
}

export function getSnapshot(): StoreState {
  return { ...state };
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startRaffleStore(
  consumerKey: string,
  pollMs: number
) {
  subscribers += 1;
  requestedPolls.set(consumerKey, pollMs);

  if (subscribers === 1) {
    const onFocus = () => refresh(true, true);
    const onVis = () => !isHidden() && refresh(true, true);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    (startRaffleStore as any)._cleanup = () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };

    refresh(false, true);
  } else {
    if (!state.items) refresh(false, true);
    scheduleNext();
  }

  return () => {
    subscribers = Math.max(0, subscribers - 1);
    requestedPolls.delete(consumerKey);

    if (subscribers <= 0) {
      clearTimer();
      aborter?.abort();
      aborter = null;
      inFlight = null;
      (startRaffleStore as any)._cleanup?.();
    } else {
      scheduleNext();
    }
  };
}