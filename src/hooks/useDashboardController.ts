// src/hooks/useDashboardController.ts
import { useState, useEffect, useCallback, useMemo } from "react";
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

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!account) {
        if (!isBackground) setIsPending(false);
        return;
      }

      if (!isBackground) setIsPending(true);

      try {
        const allRaffles = await fetchRafflesFromSubgraph({ first: 1000 });
        const myAddr = account.toLowerCase();

        // 1) My Created
        const myCreated = allRaffles.filter((r) => r.creator?.toLowerCase() === myAddr);

        // 2) My Joined (from subgraph)
        const joinedIds = new Set<string>();
        let skip = 0;
        while (true) {
          const page = await fetchMyJoinedRaffleIds(account, { first: 1000, skip });
          page.forEach((id) => joinedIds.add(id));
          if (page.length < 1000) break;
          skip += 1000;
          if (skip > 10_000) break;
        }

        const joinedBase = allRaffles.filter((r) => joinedIds.has(r.id.toLowerCase()));

        // 2b) Attach ticketsOwned (RPC) for joined raffles (cap RPC)
        const ownedByRaffleId = new Map<string, string>();
        await Promise.all(
          joinedBase.slice(0, 80).map(async (r) => {
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

        const newClaimables: ClaimableItem[] = [];
        const toCheck = Array.from(candidateById.values()).slice(0, 60);

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

              // WIN label (winner + something claimable)
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

              // REFUND label (canceled + user has tickets + something claimable)
              // NOTE: we intentionally require cf/cn > 0 to avoid "ghost" tiles after claim.
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
              // ✅ Fix: remove "Available (check on-chain)" ghost claimables after you've already claimed
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

        setCreated(myCreated);
        setJoined(myJoined);
        setClaimables(newClaimables);
      } catch (e) {
        console.error("Dashboard fetch error", e);
      } finally {
        if (!isBackground) setIsPending(false);
      }
    },
    [account]
  );

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(interval);
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
      fetchData(true);
    } catch (e) {
      console.error("Withdraw failed", e);
      setMsg("Claim failed or rejected.");
    }
  };

  const refresh = () => {
    setMsg(null);
    setHiddenClaimables({});
    fetchData(false);
  };

  return {
    data: {
      created: createdSorted,
      joined: joinedSorted,
      claimables: claimablesSorted,
      msg,
      isPending,
    },
    actions: { withdraw, refresh },
    account,
  };
}