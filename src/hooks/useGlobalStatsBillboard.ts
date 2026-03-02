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
  // Subgraph BigInt comes back as string
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

export function useGlobalStatsBillboard(): State {
  // Point this at your CACHE WORKER graphql endpoint, not the raw subgraph
  // Example: VITE_SUBGRAPH_URL="https://indexer-cache.yourdomain.com/graphql"
  const gqlUrl = useMemo(() => mustEnv("VITE_SUBGRAPH_URL"), []);

  // billboard can be pretty “fresh”, but we still don’t want to hammer from many tabs
  // Worker TTL already caches (e.g. 8s), this is an additional client guard.
  const pollMs = useMemo(() => {
    const v = env("VITE_BILLBOARD_POLL_MS");
    const n = v ? Number(v) : 15_000;
    // never poll faster than 10s
    return Number.isFinite(n) ? Math.max(10_000, Math.floor(n)) : 15_000;
  }, []);

  const [data, setData] = useState<GlobalStatsBillboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tsMs, setTsMs] = useState(() => Date.now());

  const aliveRef = useRef(true);
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

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

      fetchingRef.current = true;
      setIsLoading((prev) => prev || data === null);

      try {
        try {
          abortRef.current?.abort();
        } catch {}
        const ac = new AbortController();
        abortRef.current = ac;

        const headers: Record<string, string> = { "content-type": "application/json" };
        if (opts?.forceFresh) headers["x-force-fresh"] = "1"; // your worker supports this

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
        if (!g) {
          // subgraph not initialized yet OR global entity not created
          // treat as zeroed stats instead of hard error
          const empty: GlobalStatsBillboard = {
            totalLotteriesCreated: 0n,
            totalLotteriesSettled: 0n,
            totalLotteriesCanceled: 0n,
            totalTicketsSold: 0n,
            totalTicketRevenueUSDC: 0n,
            totalPrizesSettledUSDC: 0n,
            activeVolumeUSDC: 0n,
            updatedAt: 0n,
          };
          if (!aliveRef.current) return;
          setData(empty);
          setError(null);
          setTsMs(Date.now());
          setIsLoading(false);
          return;
        }

        const next: GlobalStatsBillboard = {
          totalLotteriesCreated: toBigInt(g.totalLotteriesCreated),
          totalLotteriesSettled: toBigInt(g.totalLotteriesSettled),
          totalLotteriesCanceled: toBigInt(g.totalLotteriesCanceled),
          totalTicketsSold: toBigInt(g.totalTicketsSold),
          totalTicketRevenueUSDC: toBigInt(g.totalTicketRevenueUSDC),
          totalPrizesSettledUSDC: toBigInt(g.totalPrizesSettledUSDC),
          activeVolumeUSDC: toBigInt(g.activeVolumeUSDC),
          updatedAt: toBigInt(g.updatedAt),
        };

        if (!aliveRef.current) return;
        setData(next);
        setError(null);
        setTsMs(Date.now());
        setIsLoading(false);
      } catch (e: any) {
        if (!aliveRef.current) return;
        // ignore aborts
        const msg = String(e?.message || e || "fetch_error");
        if (!msg.toLowerCase().includes("abort")) {
          setError(msg);
          setIsLoading(false);
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    [gqlUrl, data]
  );

  // initial + polling (paused when tab hidden)
  useEffect(() => {
    void fetchOnce();

    const t = setInterval(() => {
      void fetchOnce();
    }, pollMs);

    return () => clearInterval(t);
  }, [fetchOnce, pollMs]);

  // refresh on focus (nice for “come back to tab”)
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