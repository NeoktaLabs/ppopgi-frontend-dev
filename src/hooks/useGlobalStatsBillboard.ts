// src/hooks/useGlobalStatsBillboard.ts
import { useCallback, useEffect, useMemo, useState } from "react";

type GlobalStatsBillboard = {
  totalLotteriesCreated: bigint;
  totalLotteriesSettled: bigint;
  totalLotteriesCanceled: bigint;

  totalTicketsSold: bigint;
  totalTicketRevenueUSDC: bigint;

  totalPrizesSettledUSDC: bigint;
  activeVolumeUSDC: bigint;

  updatedAt: bigint;
};

type State = {
  data: GlobalStatsBillboard | null;
  isLoading: boolean;
  error: string | null;
  tsMs: number;
  refetch: (opts?: { forceFresh?: boolean }) => void;
};

function env(name: string): string | null {
  const v = (import.meta as any).env?.[name];
  return v ? String(v) : null;
}

function mustEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

function isHidden() {
  try {
    return typeof document !== "undefined" && document.hidden;
  } catch {
    return false;
  }
}

function toBigInt(v: any): bigint {
  try {
    if (typeof v === "bigint") return v;
    if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
    if (typeof v === "string" && v.trim() !== "") return BigInt(v);
  } catch {}
  return 0n;
}

const QUERY = /* GraphQL */ `
  query GlobalStatsBillboard {
    globalStats(id: "global") {
      totalLotteriesCreated
      totalLotteriesSettled
      totalLotteriesCanceled
      totalTicketsSold
      totalTicketRevenueUSDC
      totalPrizesSettledUSDC
      activeVolumeUSDC
      updatedAt
    }
  }
`;

const EMPTY: GlobalStatsBillboard = {
  totalLotteriesCreated: 0n,
  totalLotteriesSettled: 0n,
  totalLotteriesCanceled: 0n,
  totalTicketsSold: 0n,
  totalTicketRevenueUSDC: 0n,
  totalPrizesSettledUSDC: 0n,
  activeVolumeUSDC: 0n,
  updatedAt: 0n,
};

function isAbortLike(e: any): boolean {
  const msg = String(e?.name || e?.message || e || "").toLowerCase();
  return msg.includes("abort") || msg.includes("aborted") || msg.includes("timeout");
}

// ==============================
// ✅ Shared singleton state (module-level)
// Prevents "N components = N pollers" and avoids request storms.
// ==============================

type SharedSnapshot = Pick<State, "data" | "isLoading" | "error" | "tsMs">;

type Listener = (s: SharedSnapshot) => void;

const shared = {
  // config (set once)
  gqlUrl: null as string | null,
  pollMs: 15_000,

  // state
  data: null as GlobalStatsBillboard | null,
  isLoading: false,
  error: null as string | null,
  tsMs: Date.now(),

  // controls
  inflight: null as Promise<void> | null,
  pollTimer: null as any,
  listeners: new Set<Listener>(),

  // throttles
  lastFetchMs: 0,
  MIN_SPACING_MS: 1500,

  // fetch timeout
  CLIENT_TIMEOUT_MS: 9000,

  // "force-fresh burst" window after user actions
  forceFreshUntilMs: 0,
  FORCE_FRESH_BURST_MS: 12_000,

  // event handlers
  eventsBound: false,
};

function snapshot(): SharedSnapshot {
  return {
    data: shared.data,
    isLoading: shared.isLoading,
    error: shared.error,
    tsMs: shared.tsMs,
  };
}

function notify() {
  const s = snapshot();
  for (const fn of shared.listeners) {
    try {
      fn(s);
    } catch {
      // ignore listener errors
    }
  }
}

function inForceFreshBurst(): boolean {
  return Date.now() < shared.forceFreshUntilMs;
}

function setForceFreshBurst() {
  shared.forceFreshUntilMs = Date.now() + shared.FORCE_FRESH_BURST_MS;
}

/**
 * opts.forceFresh:
 * - true  => bypass worker edge cache (x-force-fresh=1)
 * - false => normal cached reads
 * If undefined, we auto-promote to forceFresh during burst window.
 */
async function fetchShared(opts?: { forceFresh?: boolean }) {
  if (!shared.gqlUrl) return;

  const forceFresh = opts?.forceFresh ?? inForceFreshBurst();

  // Avoid hammering in background tabs unless explicitly forced
  if (!forceFresh && isHidden()) return;

  // Coalesce concurrent requests across the whole app
  if (shared.inflight) return shared.inflight;

  const now = Date.now();

  // For normal cached reads, respect min spacing.
  // For forceFresh reads, allow "immediate" (still coalesced by inflight).
  if (!forceFresh && now - shared.lastFetchMs < shared.MIN_SPACING_MS) return;
  shared.lastFetchMs = now;

  // Only show loading spinner when empty (keeps UI stable)
  shared.isLoading = shared.data === null ? true : shared.isLoading;
  notify();

  const p = (async () => {
    const ac = new AbortController();

    const t = setTimeout(() => {
      try {
        ac.abort(new Error("timeout"));
      } catch {}
    }, shared.CLIENT_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (forceFresh) headers["x-force-fresh"] = "1";

      const res = await fetch(shared.gqlUrl!, {
        method: "POST",
        headers,
        // Let worker/browser cache normally; forceFresh only affects the worker edge cache path.
        cache: "default",
        signal: ac.signal,
        body: JSON.stringify({
          query: QUERY,
          variables: {},
          operationName: "GlobalStatsBillboard",
        }),
      });

      if (!res.ok) throw new Error(`http_${res.status}`);

      const json = await res.json().catch(() => null);
      if (!json) throw new Error("bad_json");
      if (json.errors?.length) throw new Error("graphql_error");

      const g = json.data?.globalStats;

      const next: GlobalStatsBillboard = g
        ? {
            totalLotteriesCreated: toBigInt(g.totalLotteriesCreated),
            totalLotteriesSettled: toBigInt(g.totalLotteriesSettled),
            totalLotteriesCanceled: toBigInt(g.totalLotteriesCanceled),
            totalTicketsSold: toBigInt(g.totalTicketsSold),
            totalTicketRevenueUSDC: toBigInt(g.totalTicketRevenueUSDC),
            totalPrizesSettledUSDC: toBigInt(g.totalPrizesSettledUSDC),
            activeVolumeUSDC: toBigInt(g.activeVolumeUSDC),
            updatedAt: toBigInt(g.updatedAt),
          }
        : EMPTY;

      shared.data = next;
      shared.error = null;
      shared.tsMs = Date.now();
      shared.isLoading = false;
      notify();
    } catch (e: any) {
      // Ignore abort/timeout noise if we already have data
      if (isAbortLike(e)) {
        if (shared.data === null) {
          shared.error = "timeout";
          shared.isLoading = false;
          shared.tsMs = Date.now();
          notify();
        }
        return;
      }

      const msg = String(e?.message || e || "fetch_error");
      shared.error = msg;
      shared.isLoading = false;
      shared.tsMs = Date.now();
      notify();
    } finally {
      clearTimeout(t);
    }
  })().finally(() => {
    shared.inflight = null;
    if (shared.data !== null) shared.isLoading = false;
    notify();
  });

  shared.inflight = p;
  return p;
}

function ensureSharedInitialized(gqlUrl: string, pollMs: number) {
  if (!shared.gqlUrl) shared.gqlUrl = gqlUrl;

  if (typeof pollMs === "number" && Number.isFinite(pollMs)) {
    shared.pollMs = Math.max(10_000, Math.floor(pollMs));
  }

  if (!shared.pollTimer) {
    // initial fetch (only once for the whole app)
    void fetchShared();

    shared.pollTimer = setInterval(() => {
      // cached poll unless we're in burst window
      void fetchShared();
    }, shared.pollMs);
  }

  if (!shared.eventsBound && typeof window !== "undefined") {
    shared.eventsBound = true;

    // refresh on focus (cached unless in burst)
    window.addEventListener("focus", () => void fetchShared());

    // refresh when tab becomes visible again (cached unless in burst)
    document.addEventListener("visibilitychange", () => {
      if (!isHidden()) void fetchShared();
    });

    // ✅ After user actions: enter force-fresh burst window + fetch immediately
    window.addEventListener("ppopgi:revalidate", (e: Event) => {
      const ce = e as CustomEvent<{ force?: boolean }>;
      const forced = !!ce?.detail?.force;

      // If explicitly forced, always do a forceFresh fetch.
      if (forced) {
        setForceFreshBurst();
        void fetchShared({ forceFresh: true });
        return;
      }

      // Otherwise: do a short "freshness burst" so UI reflects actions quickly.
      setForceFreshBurst();
      void fetchShared({ forceFresh: true });
    });
  }
}

export function useGlobalStatsBillboard(): State {
  const gqlUrl = useMemo(() => mustEnv("VITE_SUBGRAPH_URL"), []);

  const pollMs = useMemo(() => {
    const v = env("VITE_BILLBOARD_POLL_MS");
    const n = v ? Number(v) : 15_000;
    return Number.isFinite(n) ? Math.max(10_000, Math.floor(n)) : 15_000;
  }, []);

  const [local, setLocal] = useState<SharedSnapshot>(() => snapshot());

  useEffect(() => {
    ensureSharedInitialized(gqlUrl, pollMs);

    const listener: Listener = (s) => setLocal(s);
    shared.listeners.add(listener);

    // sync immediately after subscribing (in case init fetched between render/effect)
    setLocal(snapshot());

    return () => {
      shared.listeners.delete(listener);
    };
  }, [gqlUrl, pollMs]);

  const refetch = useCallback((opts?: { forceFresh?: boolean }) => {
    void fetchShared(opts);
  }, []);

  return {
    data: local.data,
    isLoading: local.isLoading,
    error: local.error,
    tsMs: local.tsMs,
    refetch,
  };
}