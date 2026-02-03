// src/hooks/useDashboardController.ts
import { useState, useEffect, useMemo } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { useDashboardData } from "./useDashboardData";
import { useClaimableRaffles } from "./useClaimableRaffles";

// ... (Keep ABIs from previous step) ...
const RAFFLE_HATCH_ABI = [
  { type: "function", name: "drawingRequestedAt", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "forceCancelStuck", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

const RAFFLE_MIN_ABI = [
  { type: "function", name: "withdrawFunds", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "withdrawNative", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimTicketRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export function useDashboardController() {
  const accountObj = useActiveAccount();
  const account = accountObj?.address ?? null;
  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  const dash = useDashboardData(account, 250);
  const claim = useClaimableRaffles(account, 250);

  const [msg, setMsg] = useState<string | null>(null);
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});
  
  // Hatch State
  const [drawingAtById, setDrawingAtById] = useState<Record<string, string>>({});
  const [hatchNoteById, setHatchNoteById] = useState<Record<string, string>>({});
  const [hatchBusyById, setHatchBusyById] = useState<Record<string, boolean>>({});

  // ✅ Helper: Sort by ID descending (assuming new raffles = higher ID/address or recent graph entry)
  // If your subgraph has 'createdAt', usage: b.createdAt - a.createdAt
  const sortByRecent = (list: any[] | null) => {
    if (!list) return null;
    return [...list].sort((a, b) => {
       const tA = Number(a.lastUpdatedTimestamp || 0);
       const tB = Number(b.lastUpdatedTimestamp || 0);
       // Sort by time, then by ID string descending
       return tB - tA || String(b.id).localeCompare(String(a.id));
    });
  };

  // 1. Sort the raw dashboard lists
  const createdSorted = useMemo(() => sortByRecent(dash.created), [dash.created]);
  const joinedSorted = useMemo(() => sortByRecent(dash.joined), [dash.joined]);

  // 2. Logic: Filter & Sort Claimables
  const claimables = useMemo(() => {
    if (!claim.items) return null;
    return claim.items
      .filter((it: any) => {
        if (!it?.raffle?.id || hiddenClaimables[it.raffle.id]) return false;
        const hasFunds = BigInt(it.claimableUsdc || "0") > 0n || BigInt(it.claimableNative || "0") > 0n;
        return hasFunds || !!it.roles?.participated;
      })
      .sort((a: any, b: any) => {
        const diff = BigInt(b.claimableUsdc || 0) - BigInt(a.claimableUsdc || 0);
        return diff === 0n ? 0 : diff > 0n ? 1 : -1;
      });
  }, [claim.items, hiddenClaimables]);

  // 3. Logic: Hatch Polling
  useEffect(() => {
    if (!account || !createdSorted) return; // Use sorted list
    let alive = true;
    
    // Only poll for the top 20 most recent to save RPC calls
    const targets = createdSorted
        .slice(0, 20)
        .filter((r: any) => r.creator.toLowerCase() === account.toLowerCase())
        .map((r: any) => r.id).filter(id => id && !(id in drawingAtById));

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
            const next = { ...prev };
            results.forEach(r => next[r.id] = r.val); 
            return next;
        });
    });

    return () => { alive = false; };
  }, [account, createdSorted, drawingAtById]);

  // ... (Keep actions: triggerHatch, withdraw, refresh same as before) ...
  const triggerHatch = async (raffleId: string) => {
    if (!account) return setMsg("Sign in first.");
    setHatchBusyById(p => ({ ...p, [raffleId]: true }));
    try {
        const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: raffleId, abi: RAFFLE_HATCH_ABI });
        await sendAndConfirm(prepareContractCall({ contract: c, method: "forceCancelStuck", params: [] }));
        setMsg("Hatch triggered. Refreshing...");
        setDrawingAtById(p => { const n = { ...p }; delete n[raffleId]; return n; });
        dash.refetch();
    } catch(e: any) {
        setHatchNoteById(p => ({ ...p, [raffleId]: String(e.message).includes("rejected") ? "Cancelled." : "Failed." }));
    } finally { setHatchBusyById(p => ({ ...p, [raffleId]: false })); }
  };

  const withdraw = async (raffleId: string, method: "withdrawFunds" | "withdrawNative" | "claimTicketRefund") => {
    if (!account) return setMsg("Sign in first.");
    setMsg(null);
    try {
        const c = getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: raffleId, abi: RAFFLE_MIN_ABI });
        await sendAndConfirm(prepareContractCall({ contract: c, method, params: [] }));
        setHiddenClaimables(p => ({ ...p, [raffleId]: true }));
        setMsg("Claim successful.");
        claim.refetch();
    } catch { setMsg("Claim failed or rejected."); }
  };

  const refresh = () => {
    setMsg(null); setHiddenClaimables({}); setDrawingAtById({});
    dash.refetch(); claim.refetch();
  };

  return {
    // ✅ Return the sorted lists
    data: { created: createdSorted, joined: joinedSorted, claimables, msg, isPending },
    hatch: { timestamps: drawingAtById, notes: hatchNoteById, busy: hatchBusyById, trigger: triggerHatch },
    actions: { withdraw, refresh },
    account
  };
}
