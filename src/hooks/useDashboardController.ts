// src/hooks/useDashboardController.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import {
  fetchMyJoinedRaffleIds,
  fetchRafflesByIds, // ✅ used for robust joined backfill
  type RaffleListItem,
} from "../indexer/subgraph";
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

// safer BigInt conversion
function toBigInt(v: any): bigint {
  try {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(v);
    if (typeof v === "string") return BigInt(v || "0");
    if (v?.toString) return BigInt(v.toString());
    return 0n;
  } catch {
    return 0n;
  }
}

/**
 * Simple concurrency pool to avoid hammering RPC.
 */
async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length) as any;
  let i = 0;

  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return out;
}

/**
 * Prioritize likely-claimable raffles so canceled creator refunds don't get sliced out.
 */
function scoreForClaimScan(r: RaffleListItem): number {
  // Higher = earlier
  if (r.status === "CANCELED") return 100;
  if (r.status === "COMPLETED") return 90;
  if (r.status === "DRAWING") return 50;
  if (r.status === "OPEN") return 20;
  if (r.status === "FUNDING_PENDING") return 10;
  return 0;
}

export function useDashboardController() {
  const accountObj = useActiveAccount();
  const account = accountObj?.address ?? null;
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

  const store = useRaffleStore("dashboard", 15_000);
  const allRaffles = useMemo(() => store.items ?? [], [store.items]);

  const [created, setCreated] = useState<RaffleListItem[]>([]);
  const [joined, setJoined] = useState<JoinedRaffleItem[]>([]);
  const [claimables, setClaimables] = useState<ClaimableItem[]>([]);
  const [localPending, setLocalPending] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});

  const joinedFetchInFlightRef = useRef(false);
  const joinedBackoffMsRef = useRef(0);
  const lastJoinedIdsRef = useRef<{ ts: number; ids: Set<string> } | null>(null);

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
      const maxPages = 3;

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

      if (isBackground && !isVisible()) return;

      if (!store.items) {
        setLocalPending(!isBackground);
        return;
      }

      if (!isBackground) setLocalPending(true);

      try {
        const myAddr = account.toLowerCase();

        // 1) created (from store list)
        const myCreated = allRaffles.filter((r) => r.creator?.toLowerCase() === myAddr);

        // 2) joined ids (from subgraph participant index)
        const joinedIds = await getJoinedIds();
        if (runId !== runIdRef.current) return;

        // 3) joined raffles (✅ robust)
        // Prefer fetch-by-ids (complete). If it fails/empty, fall back to store filter (yesterday behavior).
        const joinedIdArr = Array.from(joinedIds).map((x) => x.toLowerCase());
        let joinedBase: RaffleListItem[] = [];

        try {
          if (joinedIdArr.length > 0) {
            joinedBase = (await fetchRafflesByIds(joinedIdArr)) ?? [];
          }
        } catch (e) {
          console.warn("[dashboard] fetchRafflesByIds failed; falling back to store items", e);
          joinedBase = [];
        }

        if (joinedBase.length === 0 && joinedIdArr.length > 0) {
          const joinedIdSet = new Set(joinedIdArr);
          joinedBase = allRaffles.filter((r) => joinedIdSet.has(r.id.toLowerCase()));
        }

        // Merge freshness: if a raffle exists in both sources, prefer store version.
        if (joinedBase.length > 0) {
          const byId = new Map<string, RaffleListItem>();
          joinedBase.forEach((r) => byId.set(r.id.toLowerCase(), r));
          allRaffles.forEach((r) => {
            const id = r.id.toLowerCase();
            if (byId.has(id)) byId.set(id, r);
          });
          joinedBase = Array.from(byId.values());
        }

        // 3b) ticketsOwned RPC for joined list display
        const ownedByRaffleId = new Map<string, string>();
        const joinedToCheck = joinedBase.slice(0, 120);

        await mapPool(joinedToCheck, 12, async (r) => {
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

            ownedByRaffleId.set(r.id.toLowerCase(), toBigInt(owned).toString());
          } catch {
            ownedByRaffleId.set(r.id.toLowerCase(), "0");
          }
        });

        if (runId !== runIdRef.current) return;

        const myJoined: JoinedRaffleItem[] = joinedBase.map((r) => ({
          ...r,
          userTicketsOwned: ownedByRaffleId.get(r.id.toLowerCase()) ?? "0",
        }));

        /**
         * 4) claimables scan
         */
        const candidateById = new Map<string, RaffleListItem>();
        myCreated.forEach((r) => candidateById.set(r.id.toLowerCase(), r));
        joinedBase.forEach((r) => candidateById.set(r.id.toLowerCase(), r));

        const uniqueCandidates = Array.from(candidateById.values());

        uniqueCandidates.sort((a, b) => {
          const sa = scoreForClaimScan(a);
          const sb = scoreForClaimScan(b);
          if (sb !== sa) return sb - sa;
          return Number(b.lastUpdatedTimestamp || "0") - Number(a.lastUpdatedTimestamp || "0");
        });

        // Slightly safer cap for correctness around canceled/completed
        const hi = uniqueCandidates.filter((r) => r.status === "CANCELED" || r.status === "COMPLETED");
        const lo = uniqueCandidates.filter((r) => r.status !== "CANCELED" && r.status !== "COMPLETED");
        const candidates = [...hi, ...lo].slice(0, 400);

        const newClaimables: ClaimableItem[] = [];

        await mapPool(candidates, 10, async (r) => {
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

            const cf = toBigInt(cfRaw);
            const cn = toBigInt(cnRaw);
            const ticketsOwned = toBigInt(ownedRaw);

            const roles = {
              created: r.creator?.toLowerCase() === myAddr,
              participated: ticketsOwned > 0n || joinedIds.has(r.id.toLowerCase()),
            };

            const isWinnerEligible =
              r.status === "COMPLETED" &&
              r.winner?.toLowerCase() === myAddr &&
              (cf > 0n || cn > 0n);

            const isParticipantRefundEligible = r.status === "CANCELED" && ticketsOwned > 0n;

            const isCreatorCancelClaimEligible =
              r.status === "CANCELED" && roles.created && (cf > 0n || cn > 0n);

            const isOtherEligible = cf > 0n || cn > 0n;

            if (
              !isWinnerEligible &&
              !isParticipantRefundEligible &&
              !isCreatorCancelClaimEligible &&
              !isOtherEligible
            ) {
              return;
            }

            if (isWinnerEligible) {
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

            if (isParticipantRefundEligible) {
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

            if (isCreatorCancelClaimEligible) {
              newClaimables.push({
                raffle: r,
                claimableUsdc: cf.toString(),
                claimableNative: cn.toString(),
                type: "OTHER",
                roles,
                userTicketsOwned: ticketsOwned.toString(),
              });
              return;
            }

            if (isOtherEligible) {
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
        });

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

  useEffect(() => {
    if (!account) {
      setLocalPending(false);
      return;
    }
    void recompute(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, store.lastUpdatedMs]);

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
      isPending: localPending || store.isLoading,
      storeNote: store.note,
      storeLastUpdatedMs: store.lastUpdatedMs,
      joinedBackoffMs: joinedBackoffMsRef.current,
    },
    actions: { withdraw, refresh },
    account,
  };
}