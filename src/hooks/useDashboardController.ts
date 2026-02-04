// src/hooks/useDashboardController.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { fetchRafflesFromSubgraph, type RaffleListItem } from "../indexer/subgraph";

// ABIs
const RAFFLE_HATCH_ABI = [
  { type: "function", name: "drawingRequestedAt", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "forceCancelStuck", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

// Minimal ABI to check balance and claim
const RAFFLE_MIN_ABI = [
  { type: "function", name: "withdrawFunds", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimTicketRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export function useDashboardController() {
  const accountObj = useActiveAccount();
  const account = accountObj?.address ?? null;
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

  // --- State ---
  const [created, setCreated] = useState<RaffleListItem[]>([]);
  const [joined, setJoined] = useState<any[]>([]);
  const [claimables, setClaimables] = useState<any[]>([]);
  
  const [isPending, setIsPending] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});

  // Hatch State
  const [drawingAtById, setDrawingAtById] = useState<Record<string, string>>({});
  const [hatchNoteById, setHatchNoteById] = useState<Record<string, string>>({});
  const [hatchBusyById, setHatchBusyById] = useState<Record<string, boolean>>({});

  // --- 1. Silent Data Fetch ---
  const fetchData = useCallback(async (isBackground = false) => {
    if (!account) {
       if (!isBackground) setIsPending(false);
       return;
    }

    if (!isBackground) setIsPending(true);

    try {
      const allRaffles = await fetchRafflesFromSubgraph({ first: 1000 });
      const myAddr = account.toLowerCase();

      // 1. My Created
      const myCreated = allRaffles.filter(r => r.creator.toLowerCase() === myAddr);

      // 2. My Joined (Robust Check)
      const myJoined = allRaffles.filter(r => {
        // @ts-ignore
        const parts = (r.participants || []).map((p: string) => p.toLowerCase());
        return parts.includes(myAddr);
      }).map(r => {
         return { ...r, userEntry: { count: 1, percentage: "0.0" } };
      });

      // 3. Claimables (Wins & Refunds)
      // ✅ FIX: Use a Set to handle duplicates if you are both creator and participant
      const candidateIds = new Set<string>();
      myCreated.forEach(r => candidateIds.add(r.id));
      myJoined.forEach(r => candidateIds.add(r.id));

      const candidates = Array.from(candidateIds).map(id => allRaffles.find(r => r.id === id)).filter(Boolean) as RaffleListItem[];

      const newClaimables: any[] = [];

      // Process candidates in parallel to speed up checking
      await Promise.all(candidates.map(async (r) => {
        try {
          // A. Winnings (Must be winner)
          if (r.status === "COMPLETED" && r.winner && r.winner.toLowerCase() === myAddr) {
             // For winnings, we assume the full pot is available if winner matches
             newClaimables.push({
               raffle: r,
               claimableUsdc: r.winningPot, 
               claimableNative: "0",
               type: "WIN",
               roles: { participated: true }
             });
          }
          
          // B. Refunds (Canceled)
          // ✅ FIX: Verify actual on-chain balance to confirm eligibility and amount
          if (r.status === "CANCELED") {
             const contract = getContract({ 
               client: thirdwebClient, 
               chain: ETHERLINK_CHAIN, 
               address: r.id, 
               abi: RAFFLE_MIN_ABI 
             });
             
             // Check how many tickets I *actually* hold right now
             const bal = await readContract({ contract, method: "balanceOf", params: [account] });
             
             if (bal > 0n) {
                // Calculate accurate refund: Balance * TicketPrice
                const price = BigInt(r.ticketPrice || 0);
                const refundAmt = bal * price;
                
                newClaimables.push({
                  raffle: r,
                  claimableUsdc: refundAmt.toString(), // Real amount
                  claimableNative: "0",
                  type: "REFUND",
                  roles: { participated: true }
                });
             }
          }
        } catch (err) {
          console.warn(`Failed to check claim status for ${r.id}`, err);
        }
      }));

      setCreated(myCreated);
      setJoined(myJoined);
      setClaimables(newClaimables);

    } catch (e) {
      console.error("Dashboard fetch error", e);
    } finally {
      if (!isBackground) setIsPending(false);
    }
  }, [account]);

  // --- 2. Polling Effect ---
  useEffect(() => {
    fetchData(false); 
    const interval = setInterval(() => { fetchData(true); }, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- Helpers & Sorting ---
  const sortByRecent = (list: any[] | null) => {
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
      .filter((it: any) => {
        if (!it?.raffle?.id || hiddenClaimables[it.raffle.id]) return false;
        return true; 
      })
      .sort((a: any, b: any) => {
        // Refunds first
        if (a.type === "REFUND" && b.type !== "REFUND") return -1;
        if (b.type === "REFUND" && a.type !== "REFUND") return 1;
        return BigInt(b.claimableUsdc || 0) > BigInt(a.claimableUsdc || 0) ? 1 : -1;
      });
  }, [claimables, hiddenClaimables]);

  // --- Hatch Polling ---
  useEffect(() => {
    if (!account || !createdSorted) return; 
    let alive = true;
    const targets = createdSorted.slice(0, 20).filter((r: any) => r.creator.toLowerCase() === account.toLowerCase()).map((r: any) => r.id).filter(id => id && !(id in drawingAtById));
    if (!targets.length) return;
    Promise.all(targets.map(async (id) => {
        try {
            const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: id, abi: RAFFLE_HATCH_ABI });
            const val = await readContract({ contract: c, method: "drawingRequestedAt", params: [] });
            return { id, val: String(val), ok: true };
        } catch { return { id, val: "0", ok: false }; }
    })).then((results) => {
        if (!alive) return;
        setDrawingAtById(prev => { 
            const n = { ...prev }; 
            results.forEach(r => n[r.id] = r.val); 
            return n; 
        });
    });
    return () => { alive = false; };
  }, [account, createdSorted, drawingAtById]);

  // --- Actions ---
  const triggerHatch = async (raffleId: string) => {
    if (!account) return setMsg("Sign in first.");
    setHatchBusyById(p => ({ ...p, [raffleId]: true }));
    try {
        const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: raffleId, abi: RAFFLE_HATCH_ABI });
        await sendAndConfirm(prepareContractCall({ contract: c, method: "forceCancelStuck", params: [] }));
        setMsg("Hatch triggered. Refreshing...");
        setDrawingAtById(p => { const n = { ...p }; delete n[raffleId]; return n; });
        fetchData(true);
    } catch(e: any) {
        setHatchNoteById(p => ({ ...p, [raffleId]: String(e.message).includes("rejected") ? "Cancelled." : "Failed." }));
    } finally { setHatchBusyById(p => ({ ...p, [raffleId]: false })); }
  };

  const withdraw = async (raffleId: string, method: string) => {
    if (!account) return setMsg("Sign in first.");
    setMsg(null);
    try {
        const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: raffleId, abi: RAFFLE_MIN_ABI });
        // @ts-ignore
        await sendAndConfirm(prepareContractCall({ contract: c, method, params: [] }));
        setHiddenClaimables(p => ({ ...p, [raffleId]: true }));
        setMsg("Claim successful.");
        fetchData(true); 
    } catch { setMsg("Claim failed or rejected."); }
  };

  const refresh = () => {
    setMsg(null); setHiddenClaimables({}); setDrawingAtById({});
    fetchData(false);
  };

  return {
    data: { created: createdSorted, joined: joinedSorted, claimables: claimablesSorted, msg, isPending },
    hatch: { timestamps: drawingAtById, notes: hatchNoteById, busy: hatchBusyById, trigger: triggerHatch },
    actions: { withdraw, refresh },
    account
  };
}
