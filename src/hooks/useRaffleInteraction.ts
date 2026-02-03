// src/hooks/useRaffleInteraction.ts
import { useState, useEffect, useMemo } from "react";
import { formatUnits, parseUnits } from "ethers";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { ADDRESSES } from "../config/contracts";
import { useRaffleDetails } from "./useRaffleDetails";

// --- Helpers moved out of UI ---
function short(a: string) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }
function fmtUsdc(raw: string) { try { return formatUnits(BigInt(raw || "0"), 6); } catch { return "0"; } }
function clampInt(n: number, min: number, max: number) { return Math.min(max, Math.max(min, Math.floor(n))); }
function toInt(v: string, fb = 0) { const n = Number(v); return Number.isFinite(n) ? Math.floor(n) : fb; }

export function useRaffleInteraction(raffleId: string | null, isOpen: boolean) {
  // 1. Core Data
  const { data, loading, note } = useRaffleDetails(raffleId, isOpen);
  const account = useActiveAccount();
  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();
  
  // 2. Local State
  const [nowMs, setNowMs] = useState(Date.now());
  const [tickets, setTickets] = useState("1");
  const [buyMsg, setBuyMsg] = useState<string | null>(null);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // 3. Derived Logic
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(t); }, []);
  
  const deadlineMs = Number(data?.deadline || "0") * 1000;
  const deadlinePassed = deadlineMs > 0 && nowMs >= deadlineMs;
  
  // Status Logic
  let displayStatus = "Unknown";
  if (data) {
    if (data.status === "OPEN" && deadlinePassed) displayStatus = "Finalizing";
    else if (data.status === "FUNDING_PENDING") displayStatus = "Getting ready";
    else if (data.status === "COMPLETED") displayStatus = "Settled";
    else if (data.status === "CANCELED") displayStatus = "Canceled";
    else if (data.status === "OPEN") displayStatus = "Open";
    else displayStatus = data.status.charAt(0) + data.status.slice(1).toLowerCase(); // Fallback
  }

  const minBuy = Math.floor(Number(data?.minPurchaseAmount || "1") || 1);
  const soldNow = Number(data?.sold || "0");
  const maxTicketsN = Number(data?.maxTickets || "0");
  const remaining = maxTicketsN > 0 ? Math.max(0, maxTicketsN - soldNow) : 500; // 500 hard cap for UX
  const maxBuy = Math.max(minBuy, remaining);
  
  // Ticket Math
  const ticketCount = clampInt(toInt(tickets, minBuy), minBuy, maxBuy);
  const ticketPriceU = BigInt(data?.ticketPrice || "0");
  const totalCostU = BigInt(ticketCount) * ticketPriceU;

  // Contracts
  const raffleContract = useMemo(() => raffleId ? getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: raffleId }) : null, [raffleId]);
  const usdcContract = useMemo(() => {
    if (!data?.usdcToken) return null;
    return getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: data.usdcToken });
  }, [data?.usdcToken]);

  // Permissions
  const hasEnoughAllowance = allowance !== null ? allowance >= totalCostU : false;
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= totalCostU : true;
  const raffleIsOpen = data?.status === "OPEN" && !data.paused && !deadlinePassed;
  const isConnected = !!account?.address;

  // Actions
  const refreshAllowance = async () => {
    if (!isOpen || !account?.address || !usdcContract || !raffleId) return;
    setAllowLoading(true);
    try {
      const [bal, a] = await Promise.all([
        readContract({ contract: usdcContract, method: "function balanceOf(address) view returns (uint256)", params: [account.address] }),
        readContract({ contract: usdcContract, method: "function allowance(address,address) view returns (uint256)", params: [account.address, raffleId] }),
      ]);
      setUsdcBal(BigInt(bal as any));
      setAllowance(BigInt(a as any));
    } catch { setUsdcBal(null); setAllowance(null); }
    finally { setAllowLoading(false); }
  };

  const approve = async () => {
    setBuyMsg(null);
    if (!account?.address || !usdcContract || !raffleId) return;
    try {
      const tx = prepareContractCall({ contract: usdcContract, method: "function approve(address,uint256) returns (bool)", params: [raffleId, totalCostU] });
      await sendAndConfirm(tx);
      setBuyMsg("✅ Coins allowed.");
      refreshAllowance();
    } catch { setBuyMsg("Approval failed."); }
  };

  const buy = async () => {
    setBuyMsg(null);
    if (!account?.address || !raffleContract) return;
    try {
      const tx = prepareContractCall({ contract: raffleContract, method: "function buyTickets(uint256)", params: [BigInt(ticketCount)] });
      await sendAndConfirm(tx);
      setBuyMsg("🎉 Tickets purchased!");
      refreshAllowance();
    } catch (e: any) {
      if (String(e).includes("insufficient")) setBuyMsg("Not enough coins.");
      else setBuyMsg("Purchase failed."); 
    }
  };

  const handleShare = async () => {
    if (!raffleId) return;
    const url = `${window.location.origin}/?raffle=${raffleId}`;
    try {
        await navigator.clipboard.writeText(url);
        setCopyMsg("Link copied!");
    } catch { setCopyMsg("Could not copy."); }
    setTimeout(() => setCopyMsg(null), 1500);
  };

  useEffect(() => {
     if (isOpen) { 
        setTickets(String(minBuy)); setBuyMsg(null); refreshAllowance(); 
     }
  }, [isOpen, raffleId, minBuy, account?.address]);

  return {
    state: { data, loading, note, tickets, buyMsg, copyMsg, displayStatus, isConnected, isPending, allowLoading, usdcBal, allowance },
    math: { minBuy, maxBuy, ticketCount, totalCostU, fmtUsdc, short, nowMs, deadlineMs },
    flags: { hasEnoughAllowance, hasEnoughBalance, raffleIsOpen, canBuy: isConnected && raffleIsOpen && hasEnoughAllowance && hasEnoughBalance },
    actions: { setTickets, approve, buy, handleShare }
  };
}
