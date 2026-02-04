// src/hooks/useDashboardController.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import {
  fetchMyJoinedRaffleIds,
  type RaffleListItem,
} from "../indexer/subgraph";

import {
  getSnapshot,
  subscribe,
  startRaffleStore,
  refresh as refreshRaffleStore,
} from "./useRaffleStore";

// Minimal ABI for dashboard logic
const RAFFLE_DASH_ABI = [
  { type: "function", name: "withdrawFunds", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "withdrawNative", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimTicketRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },

  {
    type: "function",
    name: "ticketsOwned",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimableFunds",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimableNative",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

type JoinedRaffleItem = RaffleListItem & {
  userTicketsOwned: string; // bigint string
};

type ClaimableItem = {
  raffle: RaffleListItem;
  claimableUsdc: string; // bigint string
  claimableNative: string; // bigint string
  type: "WIN" | "REFUND" | "OTHER";
  roles: { participated?: boolean; created?: boolean };
  userTicketsOwned?: string;
};

function isRateLimitError(e: unknown) {
  const msg = String((e as any)?.message ?? e ?? "");
  return (
    msg.includes("429") ||
    msg.toLowerCase().includes("too many requests") ||
    msg.toLowerCase().includes("rate limit")
  );
}

function isVisible() {
  try {
    return document.visibilityState === "visible";
  } catch {
    return true;
  }
}

export function useDashboardController() {
  const accountObj = useActiveAccount();
  const account = accountObj?.address ?? null;
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

  // Store snapshot (single shared indexer polling)
  const [storeSnap, setStoreSnap] = useState(() => getSnapshot());

  const [created, setCreated] = useState<RaffleListItem[]>([]);
  const [joined, setJoined] = useState<JoinedRaffleItem[]>([]);
  const [claimables, setClaimables] = useState<ClaimableItem[]>([]);
  const [isPending, setIsPending] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});

  // --- per-user caches/backoff (for joinedIds query only) ---
  const joinedFetchInFlightRef = useRef(false);
  const joinedBackoffMsRef = useRef(0);
  const joinedTimerRef = useRef<number | null>(null);
  const lastJoinedIdsRef = useRef<{ ts: number; ids: Set<string> } | null>(null);

  // --- subscribe to store once ---
  useEffect(() => {
    const stop = startRaffleStore("dashboard", 15_000); // dashboard asks for 15s freshness
    const unsub = subscribe(() => setStoreSnap(getSnapshot()));
    setStoreSnap(getSnapshot());

    return () => {
      unsub();
      stop();
    };
  }, []);

  const allRaffles = useMemo(() => storeSnap.items ?? [], [storeSnap.items]);

  // --- fetch joined IDs with caching + backoff ---
  const getJoinedIds = useCallback(async (): Promise<Set<string>> => {
    if (!account) return new Set<string>();

    const now = Date.now();
    const cached = lastJoinedIdsRef.current;
    if (cached && now - cached.ts < 60_000) return cached.ids;

    // prevent overlapping calls
    if (joinedFetchInFlightRef.current) {
      return cached?.ids ?? new Set<string>();
    }

    joinedFetchInFlightRef.current = true;

    try {
      const ids = new Set<string>();
      let skip = 0;

      const pageSize = 1000;
      const maxPages = 3; // cap to protect indexer
      for (let pageN = 0; pageN < maxPages; pageN++) {
        const page = await fetchMyJoinedRaffleIds(account, { first: pageSize, skip });
        page.forEach((id) => ids.add(id.toLowerCase()));
        if (page.length < pageSize) break;
        skip += pageSize;
      }

      lastJoinedIdsRef.current = { ts: now, ids };
      joinedBackoffMsRef.current = 0;
      return ids;
    } catch (e) {
      if (isRateLimitError(e)) {
        const cur = joinedBackoffMsRef.current || 0;
        joinedBackoffMsRef.current = cur === 0 ? 15_000 : Math.min(cur * 2, 120_000);
        setMsg("Indexer rate-limited. Retrying shortly…");
      } else {
        console.error("fetchMyJoinedRaffleIds failed", e);
      }
      return cached?.ids ?? new Set<string>();
    } finally {
      joinedFetchInFlightRef.current = false;
    }
  }, [account]);

  const recompute = useCallback(
    async (isBackground = false) => {
      if (!account) {
        setCreated([]);
        setJoined([]);
        setClaimables([]);
        setIsPending(false);
        return;
      }

      // Don’t do heavy work if background & tab hidden
      if (isBackground && !isVisible()) return;

      // If store has no data yet, wait
      if (!storeSnap.items) {
        setIsPending(storeSnap.isLoading);
        return;
      }

      if (!isBackground) setIsPending(true);

      try {
        const myAddr = account.toLowerCase();

        // 1) Created from store
        const myCreated = allRaffles.filter((r) => r.creator?.toLowerCase() === myAddr);

        // 2) Joined IDs (cached)
        const joinedIds = await getJoinedIds();

        // Joined raffles from store
        const joinedBase = allRaffles.filter((r) => joinedIds.has(r.id.toLowerCase()));

        // 2b) ticketsOwned (RPC) for joined raffles (cap)
        const ownedByRaffleId = new Map<string, string>();
        const joinedToCheck = joinedBase.slice(0, 80);

        await Promise.all(
          joinedToCheck.map(async (r) => {
            try {
              const contract = getContract({
                client: thirdwebClient,
                chain: ETHERLINK_CHAIN,
                address: r.id,
                abi: RAFFLE_DASH_ABI,
              });

              const owned = await readContract({
                contract,
                method: "ticketsOwned",
                params: [account],
              });

              ownedByRaffleId.set(r.id.toLowerCase(), BigInt(owned ?? 0n).toString());
            } catch {
              ownedByRaffleId.set(r.id.toLowerCase(), "0");
            }
          })
        );

        const myJoined: JoinedRaffleItem[] = joinedBase.map((r) => ({
          ...r,
          userTicketsOwned: ownedByRaffleId.get(r.id.toLowerCase()) ?? "0",
        }));

        // 3) Claimables: union(created + joined)
        const candidateById = new Map<string, RaffleListItem>();
        myCreated.forEach((r) => candidateById.set(r.id.toLowerCase(), r));
        joinedBase.forEach((r) => candidateById.set(r.id.toLowerCase(), r));

        const candidates = Array.from(candidateById.values());
        const toCheck = candidates.slice(0, 60);

        const newClaimables: ClaimableItem[] = [];

        await Promise.all(
          toCheck.map(async (r) => {
            try {
              const contract = getContract({
                client: thirdwebClient,
                chain: ETHERLINK_CHAIN,
                address: r.id,
                abi: RAFFLE_DASH_ABI,
              });

              const [cfRaw, cnRaw, ownedRaw] = await Promise.all([
                readContract({ contract, method: "claimableFunds", params: [account] }),
                readContract({ contract, method: "claimableNative", params: [account] }),
                readContract({ contract, method: "ticketsOwned", params: [account] }),
              ]);

              const cf = BigInt(cfRaw ?? 0n);
              const cn = BigInt(cnRaw ?? 0n);
              const ticketsOwned = BigInt(ownedRaw ?? 0n);

              const roles = {
                created: r.creator?.toLowerCase() === myAddr,
                participated: ticketsOwned > 0n || joinedIds.has(r.id.toLowerCase()),
              };

              // WIN (winner + something claimable)
              if (
                r.status === "COMPLETED" &&
                r.winner?.toLowerCase() === myAddr &&
                (cf > 0n || cn > 0n)
              ) {
                newClaimables.push({
                  raffle: r,
                  claimableUsdc: cf.toString(),
                  claimableNative: cn.toString(),
                  type: "WIN",
                  roles,
                  userTicketsOwned: ticketsOwned.toString(),
                });
                return;
              }

              // REFUND (canceled + user has tickets + something claimable)
              if (r.status === "CANCELED" && ticketsOwned > 0n && (cf > 0n || cn > 0n)) {
                newClaimables.push({
                  raffle: r,
                  claimableUsdc: cf.toString(),
                  claimableNative: cn.toString(),
                  type: "REFUND",
                  roles,
                  userTicketsOwned: ticketsOwned.toString(),
                });
                return;
              }

              // OTHER (only when contract reports something claimable)
              if (cf > 0n || cn > 0n) {
                newClaimables.push({
                  raffle: r,
                  claimableUsdc: cf.toString(),
                  claimableNative: cn.toString(),
                  type: "OTHER",
                  roles,
                  userTicketsOwned: ticketsOwned.toString(),
                });
              }
            } catch {
              // ignore per-raffle
            }
          })
        );

        setCreated(myCreated);
        setJoined(myJoined);
        setClaimables(newClaimables);
      } catch (e) {
        console.error("Dashboard recompute error", e);
        if (!isBackground) setMsg("Failed to load dashboard data.");
      } finally {
        if (!isBackground) setIsPending(false);
      }
    },
    [account, allRaffles, getJoinedIds, storeSnap.items, storeSnap.isLoading]
  );

  // Recompute when store updates (and we have an account)
  useEffect(() => {
    if (!account) return;
    // do lightweight recompute on store changes
    void recompute(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, storeSnap.lastUpdatedMs]);

  // Initial recompute + smart triggers
  useEffect(() => {
    if (!account) {
      setIsPending(false);
      return;
    }

    void recompute(false);

    const onFocus = () => {
      // on return to tab, force store refresh + recompute
      void refreshRaffleStore(true, true);
      void recompute(true);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        void refreshRaffleStore(true, true);
        void recompute(true);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [account, recompute]);

  // Optional: soft timer for joinedIds refresh (separate from store)
  useEffect(() => {
    if (joinedTimerRef.current) window.clearTimeout(joinedTimerRef.current);
    if (!account) return;

    const tick = async () => {
      if (!isVisible()) {
        joinedTimerRef.current = window.setTimeout(tick, 60_000);
        return;
      }

      // expire joined cache to allow refresh
      const cached = lastJoinedIdsRef.current;
      if (!cached || Date.now() - cached.ts >= 60_000) {
        await getJoinedIds();
        await recompute(true);
      }

      const base = 30_000; // check joined ids every 30s (cheap because cached)
      const extra = joinedBackoffMsRef.current || 0;
      joinedTimerRef.current = window.setTimeout(tick, Math.max(base, base + extra));
    };

    joinedTimerRef.current = window.setTimeout(tick, 30_000);
    return () => {
      if (joinedTimerRef.current) window.clearTimeout(joinedTimerRef.current);
    };
  }, [account, getJoinedIds, recompute]);

  const createdSorted = useMemo(
    () =>
      [...created].sort(
        (a, b) => Number(b.lastUpdatedTimestamp || "0") - Number(a.lastUpdatedTimestamp || "0")
      ),
    [created]
  );

  const joinedSorted = useMemo(
    () =>
      [...joined].sort(
        (a, b) => Number(b.lastUpdatedTimestamp || "0") - Number(a.lastUpdatedTimestamp || "0")
      ),
    [joined]
  );

  const claimablesSorted = useMemo(
    () => claimables.filter((c) => !hiddenClaimables[c.raffle.id.toLowerCase()]),
    [claimables, hiddenClaimables]
  );

  const withdraw = async (
    raffleId: string,
    method: "withdrawFunds" | "withdrawNative" | "claimTicketRefund"
  ) => {
    if (!account) return;
    setMsg(null);

    try {
      const c = getContract({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: raffleId,
        abi: RAFFLE_DASH_ABI,
      });

      await sendAndConfirm(prepareContractCall({ contract: c, method, params: [] }));

      setHiddenClaimables((p) => ({ ...p, [raffleId.toLowerCase()]: true }));
      setMsg("Claim successful.");

      // Bust caches and force refresh
      lastJoinedIdsRef.current = null;
      joinedBackoffMsRef.current = 0;

      await refreshRaffleStore(true, true);
      await recompute(true);
    } catch (e) {
      console.error("Withdraw failed", e);
      setMsg("Claim failed or rejected.");
    }
  };

  const refresh = async () => {
    setMsg(null);
    setHiddenClaimables({});
    lastJoinedIdsRef.current = null;
    joinedBackoffMsRef.current = 0;

    await refreshRaffleStore(false, true);
    await recompute(false);
  };

  return {
    data: {
      created: createdSorted,
      joined: joinedSorted,
      claimables: claimablesSorted,
      msg,
      isPending: isPending || storeSnap.isLoading, // include store loading
      // helpful for debugging
      storeNote: storeSnap.note,
      storeLastUpdatedMs: storeSnap.lastUpdatedMs,
      joinedBackoffMs: joinedBackoffMsRef.current,
    },
    actions: { withdraw, refresh },
    account,
  };
}