// src/hooks/useLotteryInteraction.ts

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { formatUnits } from "ethers";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { useRaffleDetails } from "./useLotteryDetails";
import { useConfetti } from "./useConfetti";
import { ADDRESSES } from "../config/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";
const isZeroAddr = (a: any) => String(a || "").toLowerCase() === ZERO;

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}
function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}
function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)));
}
function toInt(v: string, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fb;
}

function safeTxHash(receipt: any): string {
  return String(
    receipt?.transactionHash ||
      receipt?.hash ||
      receipt?.receipt?.transactionHash ||
      receipt?.receipt?.hash ||
      ""
  ).toLowerCase();
}

// -------------------- App events --------------------

type ActivityDetail = {
  type: "BUY" | "CREATE" | "WIN" | "CANCEL";
  lotteryId: string;
  lotteryName: string;
  subject: string; // buyer/creator/winner
  value: string; // ticket count OR winningPot OR "0"
  timestamp: string; // seconds
  txHash: string;
  pendingLabel?: string;
};

function emitActivity(detail: ActivityDetail) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ppopgi:activity", { detail }));
  } catch {}
}

export function useRaffleInteraction(lotteryId: string | null, isOpen: boolean) {
  // NOTE: this hook still consumes useRaffleDetails; rename later if you like
  const { data, loading, note } = useRaffleDetails(lotteryId, isOpen);

  const account = useActiveAccount();
  const me = account?.address ?? null;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();
  const { fireConfetti } = useConfetti();

  const [nowMs, setNowMs] = useState(Date.now());
  const [tickets, setTickets] = useState("1");
  const [buyMsg, setBuyMsg] = useState<string | null>(null);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // ✅ revalidate ping (Home/Explore/ActivityBoard/etc)
  const delayedRevalRef = useRef<number | null>(null);

  const emitRevalidate = useCallback((withDelayedPing = true) => {
    try {
      if (typeof window === "undefined") return;
      window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
    } catch {}

    if (!withDelayedPing) return;

    // delayed ping to catch subgraph ingest lag
    try {
      if (typeof window === "undefined") return;
      if (delayedRevalRef.current != null) window.clearTimeout(delayedRevalRef.current);
      delayedRevalRef.current = window.setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
        } catch {}
      }, 6000);
    } catch {}
  }, []);

  // ✅ optimistic store patch (instant list bump)
  // IMPORTANT: updated store expects { lotteryId } (not raffleId)
  const emitOptimisticBuy = useCallback(
    (deltaSold: number, patchId?: string) => {
      try {
        if (typeof window === "undefined" || !lotteryId) return;

        // Optional: store supports deltaRevenue (lets ticketRevenue bump instantly too)
        const deltaRevenue = (() => {
          try {
            const price = BigInt((data as any)?.ticketPrice || "0");
            const d = BigInt(Math.max(0, Math.floor(deltaSold)));
            return (price * d).toString();
          } catch {
            return undefined;
          }
        })();

        window.dispatchEvent(
          new CustomEvent("ppopgi:optimistic", {
            detail: {
              kind: "BUY",
              patchId,
              lotteryId,
              deltaSold,
              deltaRevenue,
              tsMs: Date.now(),
            },
          })
        );
      } catch {}
    },
    [lotteryId, data]
  );

  useEffect(() => {
    return () => {
      if (delayedRevalRef.current != null) {
        window.clearTimeout(delayedRevalRef.current);
        delayedRevalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  const soldNow = Number((data as any)?.sold || "0");
  const maxTicketsN = Number((data as any)?.maxTickets || "0");
  const maxReached = maxTicketsN > 0 && soldNow >= maxTicketsN;

  const deadlineMs = Number((data as any)?.deadline || "0") * 1000;
  const deadlinePassed = deadlineMs > 0 && nowMs >= deadlineMs;

  const remainingTickets = maxTicketsN > 0 ? Math.max(0, maxTicketsN - soldNow) : null;

  let displayStatus = "Unknown";
  if (data) {
    if (data.status === "OPEN" && (deadlinePassed || maxReached)) displayStatus = "Finalizing";
    else if (data.status === "FUNDING_PENDING") displayStatus = "Getting ready";
    else if (data.status === "COMPLETED") displayStatus = "Settled";
    else if (data.status === "CANCELED") displayStatus = "Canceled";
    else if (data.status === "OPEN") displayStatus = "Open";
    else displayStatus = data.status.charAt(0) + data.status.slice(1).toLowerCase();
  }

  const uiMinBuy = 1;
  const uiMaxBuy = maxTicketsN > 0 ? Math.max(0, remainingTickets || 0) : 500;

  const ticketCount = clampInt(toInt(tickets, uiMinBuy), uiMinBuy, Math.max(uiMinBuy, uiMaxBuy));

  const ticketPriceU = BigInt((data as any)?.ticketPrice || "0");
  const totalCostU = BigInt(ticketCount) * ticketPriceU;

  const lotteryContract = useMemo(() => {
    if (!lotteryId) return null;
    return getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: lotteryId });
  }, [lotteryId]);

  /**
   * ✅ IMPORTANT:
   * Use the lottery's indexed usdcToken when available, otherwise fall back to global config.
   */
  const paymentTokenAddr = useMemo(() => {
    const onchain = String((data as any)?.usdcToken || "").trim();
    if (onchain && !isZeroAddr(onchain)) return onchain;
    return ADDRESSES.USDC;
  }, [data]);

  const usdcContract = useMemo(() => {
    const addr = paymentTokenAddr;
    if (!addr || isZeroAddr(addr)) return null;
    return getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: addr });
  }, [paymentTokenAddr]);

  const isConnected = !!account?.address;

  const lotteryIsOpen =
    (data as any)?.status === "OPEN" &&
    !(data as any)?.paused &&
    !deadlinePassed &&
    !maxReached &&
    (maxTicketsN === 0 || (remainingTickets ?? 0) > 0);

  const hasEnoughAllowance = allowance !== null ? allowance >= totalCostU : false;
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= totalCostU : true;

  const allowInFlight = useRef(false);
  const lastAllowFetchAt = useRef(0);

  const refreshAllowance = useCallback(
    async (reason: "open" | "postTx" | "manual" = "manual") => {
      if (!isOpen) return;
      if (!account?.address || !usdcContract || !lotteryId) return;

      const now = Date.now();
      const minGap = reason === "postTx" ? 0 : 2500;
      if (now - lastAllowFetchAt.current < minGap) return;

      if (allowInFlight.current) return;
      allowInFlight.current = true;
      lastAllowFetchAt.current = now;

      setAllowLoading(true);

      try {
        const [bal, a] = await Promise.all([
          readContract({
            contract: usdcContract,
            method: "function balanceOf(address) view returns (uint256)",
            params: [account.address],
          }),
          readContract({
            contract: usdcContract,
            method: "function allowance(address,address) view returns (uint256)",
            params: [account.address, lotteryId],
          }),
        ]);

        setUsdcBal(BigInt(bal as any));
        setAllowance(BigInt(a as any));
      } catch {
        setUsdcBal(null);
        setAllowance(null);
      } finally {
        setAllowLoading(false);
        allowInFlight.current = false;
      }
    },
    [isOpen, account?.address, usdcContract, lotteryId]
  );

  const approve = useCallback(async () => {
    setBuyMsg(null);

    if (!account?.address || !lotteryId) return;

    if (!usdcContract) {
      setBuyMsg("Payment token unavailable. Please retry.");
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address,uint256) returns (bool)",
        params: [lotteryId, totalCostU],
      });
      await sendAndConfirm(tx);

      setBuyMsg("✅ Wallet prepared.");
      refreshAllowance("postTx");

      emitRevalidate(false);
    } catch {
      setBuyMsg("Prepare wallet failed.");
    }
  }, [account?.address, usdcContract, lotteryId, totalCostU, sendAndConfirm, refreshAllowance, emitRevalidate]);

  const buy = useCallback(async () => {
    setBuyMsg(null);
    if (!account?.address || !lotteryContract || !lotteryId) return;

    try {
      const tx = prepareContractCall({
        contract: lotteryContract,
        method: "function buyTickets(uint256)",
        params: [BigInt(ticketCount)],
      });

      const receipt = await sendAndConfirm(tx);

      const txh = safeTxHash(receipt);
      const patchId = `buy:${lotteryId}:${txh || Date.now()}:${ticketCount}`;

      // ✅ instant list bump
      emitOptimisticBuy(ticketCount, patchId);

      // ✅ activity board instant UX
      const nowSec = Math.floor(Date.now() / 1000);
      emitActivity({
        type: "BUY",
        lotteryId: lotteryId.toLowerCase(),
        lotteryName: String((data as any)?.name ?? "Lottery"),
        subject: (me || "").toLowerCase(),
        value: String(ticketCount),
        timestamp: String(nowSec),
        txHash: txh || patchId,
        pendingLabel: "Indexing…",
      });

      fireConfetti();
      setBuyMsg("🎉 Tickets purchased!");
      refreshAllowance("postTx");

      emitRevalidate(true);
    } catch (e: any) {
      if (String(e).toLowerCase().includes("insufficient")) setBuyMsg("Not enough coins.");
      else setBuyMsg("Purchase failed.");
    }
  }, [
    account?.address,
    lotteryContract,
    ticketCount,
    sendAndConfirm,
    fireConfetti,
    refreshAllowance,
    emitRevalidate,
    emitOptimisticBuy,
    lotteryId,
    data,
    me,
  ]);

  const handleShare = useCallback(async () => {
    if (!lotteryId) return;

    // Keep your router convention. If your app still uses `?raffle=`, switch back.
    const url = `${window.location.origin}/?lottery=${lotteryId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopyMsg("Link copied!");
    } catch {
      setCopyMsg("Could not copy.");
    }
    setTimeout(() => setCopyMsg(null), 1500);
  }, [lotteryId]);

  useEffect(() => {
    if (!isOpen) return;

    setTickets("1");
    setBuyMsg(null);

    // reset displayed balances when switching lotteries / token
    setUsdcBal(null);
    setAllowance(null);

    refreshAllowance("open");
  }, [isOpen, lotteryId, account?.address, paymentTokenAddr, refreshAllowance]);

  return {
    state: {
      data,
      loading,
      note,
      tickets,
      buyMsg,
      copyMsg,
      displayStatus,
      isConnected,
      isPending,
      allowLoading,
      usdcBal,
      allowance,
      paymentTokenAddr,
    },
    math: {
      minBuy: uiMinBuy,
      maxBuy: uiMaxBuy,
      remainingTickets,
      maxReached,
      ticketCount,
      totalCostU,
      fmtUsdc,
      short,
      nowMs,
      deadlineMs,
    },
    flags: {
      hasEnoughAllowance,
      hasEnoughBalance,
      lotteryIsOpen,
      canBuy: isConnected && lotteryIsOpen && hasEnoughAllowance && hasEnoughBalance,
    },
    actions: {
      setTickets,
      approve,
      buy,
      handleShare,
      refreshAllowance: () => refreshAllowance("manual"),
    },
  };
}