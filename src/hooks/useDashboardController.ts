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

// ABIs
const RAFFLE_HATCH_ABI = [
  {
    type: "function",
    name: "drawingRequestedAt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "forceCancelStuck",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

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
  userTicketsOwned: string;
};

type ClaimableItem = {
  raffle: RaffleListItem;
  claimableUsdc: string;
  claimableNative: string;
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

  const [drawingAtById, setDrawingAtById] = useState<Record<string, string>>({});
  const [hatchNoteById, setHatchNoteById] = useState<Record<string, string>>({});
  const [hatchBusyById, setHatchBusyById] = useState<Record<string, boolean>>({});

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

        const myCreated = allRaffles.filter((r) => r.creator?.toLowerCase() === myAddr);

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
              const owned = await readContract({ contract, method: "ticketsOwned", params: [account] });
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

        const candidateById = new Map<string, RaffleListItem>();
        myCreated.forEach((r) => candidateById.set(r.id.toLowerCase(), r));
        joinedBase.forEach((r) => candidateById.set(r.id.toLowerCase(), r));

        const newClaimables: ClaimableItem[] = [];

        await Promise.all(
          Array.from(candidateById.values())
            .slice(0, 60)
            .map(async (r) => {
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

                // ✅ FIX: player ticket refunds
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
              } catch {}
            })
        );

        setCreated(myCreated);
        setJoined(myJoined);
        setClaimables(newClaimables);
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
    () => [...created].sort((a, b) => Number(b.lastUpdatedTimestamp) - Number(a.lastUpdatedTimestamp)),
    [created]
  );

  const joinedSorted = useMemo(
    () => [...joined].sort((a, b) => Number(b.lastUpdatedTimestamp) - Number(a.lastUpdatedTimestamp)),
    [joined]
  );

  const claimablesSorted = useMemo(
    () =>
      claimables.filter((c) => !hiddenClaimables[c.raffle.id.toLowerCase()]),
    [claimables, hiddenClaimables]
  );

  const withdraw = async (
    raffleId: string,
    method: "withdrawFunds" | "withdrawNative" | "claimTicketRefund"
  ) => {
    if (!account) return;
    const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: raffleId, abi: RAFFLE_DASH_ABI });
    await sendAndConfirm(prepareContractCall({ contract: c, method, params: [] }));
    setHiddenClaimables((p) => ({ ...p, [raffleId.toLowerCase()]: true }));
    fetchData(true);
  };

  return {
    data: {
      created: createdSorted,
      joined: joinedSorted,
      claimables: claimablesSorted,
      msg,
      isPending,
    },
    actions: { withdraw },
    account,
  };
}