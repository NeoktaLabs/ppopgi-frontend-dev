// src/hooks/useGlobalStatsBillboard.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export function useGlobalStatsBillboard(): State {
  // Point this at your CACHE WORKER graphql endpoint, not the raw subgraph
  const gqlUrl = useMemo(() => mustEnv("VITE_SUBGRAPH_URL"), []);

  // Never poll faster than 10s
  const pollMs = useMemo(() => {
    const v = env("VITE_BILLBOARD_POLL_MS");
    const n = v ? Number(v) : 15_000;
    return Number.isFinite(n) ? Math.max(10_000, Math.floor(n)) : 15_000;
  }, []);

  const [data, setData] = useState<GlobalStatsBillboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tsMs, setTsMs] = useState(() => Date.now());

  const aliveRef = useRef(true);
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ✅ Keep latest data in a ref so callbacks don't depend on state
  const dataRef = useRef<GlobalStatsBillboard | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ✅ Hard throttle safeguard (prevents accidental tight loops)
  const lastFetchMsRef = useRef(0);
  const MIN_SPACING_MS = 1500; // even if something re-triggers, cap at ~0.6 req/s

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, []);

  const fetchOnce = useCallback(
    async (opts?: { forceFresh?: boolean }) => {
      if (fetchingRef.current) return;
      if (isHidden()) return;

      const now = Date.now();
      if (!opts?.forceFresh && now - lastFetchMsRef.current < MIN_SPACING_MS) return;
      lastFetchMsRef.current = now;

      fetchingRef.current = true;

      // Only show loading spinner if we don't already have data
      setIsLoading((prev) => prev || dataRef.current === null);

      try {
        try {
          abortRef.current?.abort();
        } catch {}
        const ac = new AbortController();
        abortRef.current = ac;

        const headers: Record<string, string> = { "content-type": "application/json" };
        if (opts?.forceFresh) headers["x-force-fresh"] = "1";

        const res = await fetch(gqlUrl, {
          method: "POST",
          headers,
          cache: "no-store",
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

        // Treat missing entity as zeroed stats (subgraph not initialized yet)
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

        if (!aliveRef.current) return;

        setData(next);
        setError(null);
        setTsMs(Date.now());
        setIsLoading(false);
      } catch (e: any) {
        if (!aliveRef.current) return;

        const msg = String(e?.message || e || "fetch_error");
        // ignore aborts
        if (!msg.toLowerCase().includes("abort")) {
          setError(msg);
          setIsLoading(false);
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    [gqlUrl]
  );

  // initial + polling (paused when tab hidden)
  useEffect(() => {
    void fetchOnce();

    const t = setInterval(() => {
      void fetchOnce();
    }, pollMs);

    return () => clearInterval(t);
  }, [fetchOnce, pollMs]);

  // refresh on focus
  useEffect(() => {
    const onFocus = () => void fetchOnce();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchOnce]);

  const refetch = useCallback(
    (opts?: { forceFresh?: boolean }) => {
      void fetchOnce(opts);
    },
    [fetchOnce]
  );

  return { data, isLoading, error, tsMs, refetch };
}