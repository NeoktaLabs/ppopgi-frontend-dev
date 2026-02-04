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

// ✅ Minimal ABI for dashboard logic (LotterySingleWinnerV2)
const RAFFLE_DASH_ABI = [
  // claim actions
  { type: "function", name: "withdrawFunds", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "withdrawNative", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimTicketRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },

  // reads
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
  // useful for UI badges
  userTicketsOwned?: string;
};

export function useDashboardController() {
  const accountObj = useActiveAccount();
  const account = accountObj?.address ?? null;
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

  // --- State ---
  const [created, setCreated] = useState<RaffleListItem[]>([]);
  const [joined, setJoined] = useState<JoinedRaffleItem[]>([]);
  const [claimables, setClaimables] = useState<ClaimableItem[]>([]);

  const [isPending, setIsPending] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});

  // Hatch State
  const [drawingAtById, setDrawingAtById] = useState<Record<string, string>>({});
  const [hatchNoteById, setHatchNoteById] = useState<Record<string, string>>({});
  const [hatchBusyById, setHatchBusyById] = useState<Record<string, boolean>>({});

  // --- 1. Silent Data Fetch ---
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

        // 2) My Joined: use subgraph participant index
        const joinedIds = new Set<string>();
        let skip = 0;
        while (true) {
          const page = await fetchMyJoinedRaffleIds(account, { first: 1000, skip });
          page.forEach((id) => joinedIds.add(id));
          if (page.length < 1000) break;
          skip += 1000;
          if (skip > 10_000) break;
        }

        // Build the joined list from raffles we already fetched
        const joinedBase = allRaffles.filter((r) => joinedIds.has(r.id.toLowerCase()));

        // ✅ NEW: attach userTicketsOwned per joined raffle (RPC)
        // Keep RPC pressure reasonable
        const joinedToCheck = joinedBase.slice(0, 80);

        const ownedByRaffleId = new Map<string, string>();
        await Promise.all(
          joinedToCheck.map(async (r) => {
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

        // 3) Claimables: union(created + joined)
        const candidateById = new Map<string, RaffleListItem>();
        myCreated.forEach((r) => candidateById.set(r.id.toLowerCase(), r));
        joinedBase.forEach((r) => candidateById.set(r.id.toLowerCase(), r));
        const candidates = Array.from(candidateById.values());

        const newClaimables: ClaimableItem[] = [];

        // Reduce RPC load: only check a reasonable number each poll
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

              const [claimableFunds, claimableNative, owned] = await Promise.all([
                readContract({ contract, method: "claimableFunds", params: [account] }),
                readContract({ contract, method: "claimableNative", params: [account] }),
                readContract({ contract, method: "ticketsOwned", params: [account] }),
              ]);

              const cf = BigInt(claimableFunds ?? 0n);
              const cn = BigInt(claimableNative ?? 0n);
              const ticketsOwned = BigInt(owned ?? 0n);

              const roles = {
                created: r.creator?.toLowerCase() === myAddr,
                participated: ticketsOwned > 0n || joinedIds.has(r.id.toLowerCase()),
              };

              // WIN label if winner matches and there is something claimable
              if (
                r.status === "COMPLETED" &&
                r.winner &&
                r.winner.toLowerCase() === myAddr &&
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

              // REFUND label if canceled and user owns tickets and has claimable funds
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

              // Other claimables (native allocations, etc)
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
            } catch (err) {
              console.warn(`Failed to check claim status for ${r.id}`, err);
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

  // --- 2. Polling Effect ---
  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- Helpers & Sorting ---
  const sortByRecent = <T extends { lastUpdatedTimestamp?: string; id: string }>(list: T[] | null) => {
    if (!list) return null;
    return [...list].sort((a, b) => {
      const tA = Number(a.lastUpdatedTimestamp || 0);
      const tB = Number(b.lastUpdatedTimestamp || 0);
      return tB - tA || String(b.id).localeCompare(String(a.id));
    });
  };

  const createdSorted = useMemo(() => sortByRecent(created), [created]);
  const joinedSorted = useMemo(() => sortByRecent(joined), [joined]);

  // Filter Claimables
  const claimablesSorted = useMemo(() => {
    return claimables
      .filter((it) => {
        const id = it?.raffle?.id?.toLowerCase();
        if (!id || hiddenClaimables[id]) return false;
        if (BigInt(it.claimableUsdc || "0") === 0n && BigInt(it.claimableNative || "0") === 0n) return false;
        return true;
      })
      .sort((a, b) => {
        // Refunds first
        if (a.type === "REFUND" && b.type !== "REFUND") return -1;
        if (b.type === "REFUND" && a.type !== "REFUND") return 1;

        const aTotal = BigInt(a.claimableUsdc || "0") + BigInt(a.claimableNative || "0");
        const bTotal = BigInt(b.claimableUsdc || "0") + BigInt(b.claimableNative || "0");
        return aTotal === bTotal ? 0 : bTotal > aTotal ? 1 : -1;
      });
  }, [claimables, hiddenClaimables]);

  // --- Hatch Polling ---
  useEffect(() => {
    if (!account || !createdSorted) return;
    let alive = true;

    const targets = createdSorted
      .slice(0, 20)
      .filter((r: any) => r.creator.toLowerCase() === account.toLowerCase())
      .map((r: any) => r.id)
      .filter((id: string) => id && !(id in drawingAtById));

    if (!targets.length) return;

    Promise.all(
      targets.map(async (id) => {
        try {
          const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: id, abi: RAFFLE_HATCH_ABI });
          const val = await readContract({ contract: c, method: "drawingRequestedAt", params: [] });
          return { id, val: String(val), ok: true };
        } catch {
          return { id, val: "0", ok: false };
        }
      })
    ).then((results) => {
      if (!alive) return;
      setDrawingAtById((prev) => {
        const n = { ...prev };
        results.forEach((r) => (n[r.id] = r.val));
        return n;
      });
    });

    return () => {
      alive = false;
    };
  }, [account, createdSorted, drawingAtById]);

  // --- Actions ---
  const triggerHatch = async (raffleId: string) => {
    if (!account) return setMsg("Sign in first.");
    setHatchBusyById((p) => ({ ...p, [raffleId]: true }));
    try {
      const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: raffleId, abi: RAFFLE_HATCH_ABI });
      await sendAndConfirm(prepareContractCall({ contract: c, method: "forceCancelStuck", params: [] }));
      setMsg("Hatch triggered. Refreshing...");
      setDrawingAtById((p) => {
        const n = { ...p };
        delete n[raffleId];
        return n;
      });
      fetchData(true);
    } catch (e: any) {
      setHatchNoteById((p) => ({
        ...p,
        [raffleId]: String(e?.message ?? "").includes("rejected") ? "Cancelled." : "Failed.",
      }));
    } finally {
      setHatchBusyById((p) => ({ ...p, [raffleId]: false }));
    }
  };

  const withdraw = async (
    raffleId: string,
    method: "withdrawFunds" | "withdrawNative" | "claimTicketRefund"
  ) => {
    if (!account) return setMsg("Sign in first.");
    setMsg(null);

    try {
      const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: raffleId, abi: RAFFLE_DASH_ABI });
      await sendAndConfirm(prepareContractCall({ contract: c, method, params: [] }));

      setHiddenClaimables((p) => ({ ...p, [raffleId.toLowerCase()]: true }));
      setMsg("Claim successful.");
      fetchData(true);
    } catch {
      setMsg("Claim failed or rejected.");
    }
  };

  const refresh = () => {
    setMsg(null);
    setHiddenClaimables({});
    setDrawingAtById({});
    fetchData(false);
  };

  return {
    data: {
      created: createdSorted,
      joined: joinedSorted, // ✅ now includes userTicketsOwned
      claimables: claimablesSorted,
      msg,
      isPending,
    },
    hatch: { timestamps: drawingAtById, notes: hatchNoteById, busy: hatchBusyById, trigger: triggerHatch },
    actions: { withdraw, refresh },
    account,
  };
}