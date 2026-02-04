// src/hooks/useDashboardController.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { fetchMyJoinedRaffleIds, type RaffleListItem } from "../indexer/subgraph";
import { useRaffleStore, refresh as refreshRaffleStore } from "./useRaffleStore";

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
  const msg = String((e as any)?.message ?? e ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("too many requests") || msg.includes("rate");
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

  // ✅ single shared indexer poller
  const store = useRaffleStore("dashboard", 15_000);
  const allRaffles = useMemo(() => store.items ?? [], [store.items]);

  const [created, setCreated] = useState<RaffleListItem[]>([]);
  const [joined, setJoined] = useState<JoinedRaffleItem[]>([]);
  const [claimables, setClaimables] = useState<ClaimableItem[]>([]);
  const [localPending, setLocalPending] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});

  // joinedIds cache/backoff (subgraph)
  const joinedFetchInFlightRef = useRef(false);
  const joinedBackoffMsRef = useRef(0);
  const lastJoinedIdsRef = useRef<{ ts: number; ids: Set<string> } | null>(null);

  // ignore stale async responses (account switches etc.)
  const runIdRef = useRef(0);

  const getJoinedIds = useCallback(async (): Promise<Set<string>> => {
    if (!account) return new Set<string>();

    const now = Date.now();
    const cached = lastJoinedIdsRef.current;
    if (cached && now - cached.ts < 60_000) return cached.ids;

    if (joinedFetchInFlightRef.current) return cached?.ids ?? new Set<string>();
    joinedFetchInFlightRef.current = true;

    try {
      const ids = new Set<string>();
      let skip = 0;

      const pageSize = 1000;
      const maxPages = 3; // up to 3k joined records

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
      const runId = ++runIdRef.current;

      if (!account) {
        setCreated([]);
        setJoined([]);
        setClaimables([]);
        setLocalPending(false);
        return;
      }

      // don’t do heavy work in background if hidden
      if (isBackground && !isVisible()) return;

      // if store not ready, don’t recompute yet
      if (!store.items) {
        setLocalPending(!isBackground);
        return;
      }

      if (!isBackground) setLocalPending(true);

      try {
        const myAddr = account.toLowerCase();

        // 1) created
        const myCreated = allRaffles.filter((r) => r.creator?.toLowerCase() === myAddr);

        // 2) joined ids
        const joinedIds = await getJoinedIds();
        if (runId !== runIdRef.current) return;

        // 3) joined raffles
        const joinedBase = allRaffles.filter((r) => joinedIds.has(r.id.toLowerCase()));

        // 3b) ticketsOwned RPC (cap)
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

        if (runId !== runIdRef.current) return;

        const myJoined: JoinedRaffleItem[] = joinedBase.map((r) => ({
          ...r,
          userTicketsOwned: ownedByRaffleId.get(r.id.toLowerCase()) ?? "0",
        }));

        // 4) claimables = union(created + joined)
        const candidateById = new Map<string, RaffleListItem>();
        myCreated.forEach((r) => candidateById.set(r.id.toLowerCase(), r));
        joinedBase.forEach((r) => candidateById.set(r.id.toLowerCase(), r));

        const candidates = Array.from(candidateById.values()).slice(0, 60);

        const newClaimables: ClaimableItem[] = [];
        await Promise.all(
          candidates.map(async (r) => {
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

              // IMPORTANT: only show claimables if contract reports something claimable
              if (cf === 0n && cn === 0n) return;

              const roles = {
                created: r.creator?.toLowerCase() === myAddr,
                participated: ticketsOwned > 0n || joinedIds.has(r.id.toLowerCase()),
              };

              // winner claim
              if (r.status === "COMPLETED" && r.winner?.toLowerCase() === myAddr) {
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

              // refund claim
              if (r.status === "CANCELED" && ticketsOwned > 0n) {
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

              // creator / other withdraw (fees etc.)
              newClaimables.push({
                raffle: r,
                claimableUsdc: cf.toString(),
                claimableNative: cn.toString(),
                type: "OTHER",
                roles,
                userTicketsOwned: ticketsOwned.toString(),
              });
            } catch {
              // ignore per-raffle
            }
          })
        );

        if (runId !== runIdRef.current) return;

        setCreated(myCreated);
        setJoined(myJoined);
        setClaimables(newClaimables);
      } catch (e) {
        console.error("Dashboard recompute error", e);
        if (!isBackground) setMsg("Failed to load dashboard data.");
      } finally {
        if (!isBackground) setLocalPending(false);
      }
    },
    [account, allRaffles, getJoinedIds, store.items]
  );

  // recompute when store updates or account changes
  useEffect(() => {
    if (!account) {
      setLocalPending(false);
      return;
    }
    void recompute(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, store.lastUpdatedMs]);

  // focus/visibility refresh -> force store refresh + background recompute
  useEffect(() => {
    const onFocus = () => {
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
  }, [recompute]);

  const createdSorted = useMemo(
    () => [...created].sort((a, b) => Number(b.lastUpdatedTimestamp || "0") - Number(a.lastUpdatedTimestamp || "0")),
    [created]
  );

  const joinedSorted = useMemo(
    () => [...joined].sort((a, b) => Number(b.lastUpdatedTimestamp || "0") - Number(a.lastUpdatedTimestamp || "0")),
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

      // bust joined cache (in case claim changes ticketsOwned / joined state)
      lastJoinedIdsRef.current = null;
      joinedBackoffMsRef.current = 0;

      // force refresh store + recompute quickly
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
      // include store loading + local work
      isPending: localPending || store.isLoading,
      storeNote: store.note,
      storeLastUpdatedMs: store.lastUpdatedMs,
      joinedBackoffMs: joinedBackoffMsRef.current,
    },
    actions: { withdraw, refresh },
    account,
  };
}