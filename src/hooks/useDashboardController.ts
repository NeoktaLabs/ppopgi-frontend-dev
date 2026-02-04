// src/hooks/useDashboardController.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import {
  fetchRafflesFromSubgraph,
  fetchMyJoinedRaffleIds,
  type RaffleListItem,
} from "../indexer/subgraph";

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

export function useDashboardController() {
  const accountObj = useActiveAccount();
  const account = accountObj?.address ?? null;
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

  const [created, setCreated] = useState<RaffleListItem[]>([]);
  const [joined, setJoined] = useState<JoinedRaffleItem[]>([]);
  const [claimables, setClaimables] = useState<ClaimableItem[]>([]);
  const [isPending, setIsPending] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});

  // -----------------------
  // Anti-spam / caching refs
  // -----------------------
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const pollMsRef = useRef<number>(15000); // base interval
  const backoffMsRef = useRef<number>(0); // extra delay after 429
  const timerRef = useRef<number | null>(null);

  const lastRafflesRef = useRef<{ ts: number; data: RaffleListItem[] } | null>(null);
  const lastJoinedIdsRef = useRef<{ ts: number; ids: Set<string> } | null>(null);

  const isVisible = () => typeof document !== "undefined" && document.visibilityState === "visible";

  const scheduleNext = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);

    const delay = Math.max(pollMsRef.current, pollMsRef.current + backoffMsRef.current);
    timerRef.current = window.setTimeout(() => {
      // background refresh
      fetchData(true);
    }, delay);
  }, []); // fetchData declared below but safe: we only call scheduleNext inside effects/handlers after init

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!account) {
        if (!isBackground) setIsPending(false);
        return;
      }

      // Don’t hammer the indexer if tab is hidden
      if (isBackground && !isVisible()) {
        scheduleNext();
        return;
      }

      // Dedupe concurrent fetches
      if (inFlightRef.current) return;

      inFlightRef.current = true;

      if (!isBackground) setIsPending(true);

      // Cancel any prior request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const myAddr = account.toLowerCase();
        const now = Date.now();

        // -----------------------
        // 1) Pull raffles from subgraph (cache ~20s)
        // -----------------------
        let allRaffles: RaffleListItem[] = [];
        const cachedRaffles = lastRafflesRef.current;

        if (cachedRaffles && now - cachedRaffles.ts < 20_000) {
          allRaffles = cachedRaffles.data;
        } else {
          allRaffles = await fetchRafflesFromSubgraph({
            first: 1000,
            signal: controller.signal,
          });
          lastRafflesRef.current = { ts: now, data: allRaffles };
        }

        // 1) My Created
        const myCreated = allRaffles.filter((r) => r.creator?.toLowerCase() === myAddr);

        // -----------------------
        // 2) Joined raffle IDs (cache ~60s)
        // -----------------------
        let joinedIds: Set<string>;
        const cachedJoined = lastJoinedIdsRef.current;

        if (cachedJoined && now - cachedJoined.ts < 60_000) {
          joinedIds = cachedJoined.ids;
        } else {
          joinedIds = new Set<string>();
          let skip = 0;

          // IMPORTANT: keep this bounded (avoid huge pagination load)
          // You can raise maxPages if needed, but this protects your indexer.
          const pageSize = 1000;
          const maxPages = 3; // up to 3000 joined entries

          for (let pageN = 0; pageN < maxPages; pageN++) {
            const page = await fetchMyJoinedRaffleIds(account, {
              first: pageSize,
              skip,
              signal: controller.signal,
            });
            page.forEach((id) => joinedIds.add(id.toLowerCase()));
            if (page.length < pageSize) break;
            skip += pageSize;
          }

          lastJoinedIdsRef.current = { ts: now, ids: joinedIds };
        }

        // Build joined list from raffles we already fetched
        const joinedBase = allRaffles.filter((r) => joinedIds.has(r.id.toLowerCase()));

        // -----------------------
        // 2b) ticketsOwned (RPC) for joined raffles (cap)
        // -----------------------
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

        // -----------------------
        // 3) Claimables: union(created + joined)
        // -----------------------
        const candidateById = new Map<string, RaffleListItem>();
        myCreated.forEach((r) => candidateById.set(r.id.toLowerCase(), r));
        joinedBase.forEach((r) => candidateById.set(r.id.toLowerCase(), r));

        const candidates = Array.from(candidateById.values());

        const newClaimables: ClaimableItem[] = [];
        const toCheck = candidates.slice(0, 60);

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
              // Keep cf/cn gate to avoid “already claimed” ghost tiles.
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
              // ignore individual raffle errors
            }
          })
        );

        // Success: reset backoff
        backoffMsRef.current = 0;

        setCreated(myCreated);
        setJoined(myJoined);
        setClaimables(newClaimables);
      } catch (e) {
        console.error("Dashboard fetch error", e);

        // Backoff if indexer rate-limited
        if (isRateLimitError(e)) {
          // Exponential-ish backoff: 15s -> 30s -> 60s -> 120s (cap)
          const current = backoffMsRef.current || 0;
          const next = current === 0 ? 15000 : Math.min(current * 2, 120000);
          backoffMsRef.current = next;
          if (!isBackground) setMsg("Indexer rate-limited. Retrying shortly…");
        } else {
          if (!isBackground) setMsg("Failed to load dashboard data.");
        }
      } finally {
        inFlightRef.current = false;
        if (!isBackground) setIsPending(false);
        scheduleNext();
      }
    },
    [account, scheduleNext]
  );

  // Initial fetch + smart refresh triggers (focus/visibility)
  useEffect(() => {
    // clear any timers
    if (timerRef.current) window.clearTimeout(timerRef.current);

    fetchData(false);

    const onFocus = () => fetchData(true);
    const onVis = () => {
      if (document.visibilityState === "visible") fetchData(true);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);

      if (timerRef.current) window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
      inFlightRef.current = false;
    };
  }, [fetchData]);

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

      // force refresh and also reset rate-limit backoff
      backoffMsRef.current = 0;
      lastRafflesRef.current = null;
      lastJoinedIdsRef.current = null;
      fetchData(true);
    } catch (e) {
      console.error("Withdraw failed", e);
      setMsg("Claim failed or rejected.");
    }
  };

  const refresh = () => {
    setMsg(null);
    setHiddenClaimables({});
    backoffMsRef.current = 0;
    lastRafflesRef.current = null;
    lastJoinedIdsRef.current = null;
    fetchData(false);
  };

  return {
    data: {
      created: createdSorted,
      joined: joinedSorted,
      claimables: claimablesSorted,
      msg,
      isPending,
      // optional: expose current polling/backoff for UI/debug
      pollMs: pollMsRef.current,
      backoffMs: backoffMsRef.current,
    },
    actions: { withdraw, refresh },
    account,
  };
}