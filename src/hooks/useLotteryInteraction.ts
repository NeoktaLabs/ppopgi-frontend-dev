// src/hooks/useLotteryInteraction.ts

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { formatUnits, MaxUint256 } from "ethers";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { useLotteryDetails } from "./useLotteryDetails";
import { useConfetti } from "./useConfetti";
import { ADDRESSES } from "../config/contracts";

// ✅ Use your ABI files (from src/config/abis/index.ts)
import { USDC_ABI, SINGLE_WINNER_LOTTERY_ABI } from "../config/abis";

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
    receipt?.transactionHash || receipt?.hash || receipt?.receipt?.transactionHash || receipt?.receipt?.hash || ""
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

/**
 * Very small in-memory cache for allowance/balance reads.
 * Goal: avoid re-reading when modal reopens quickly or state re-renders.
 */
type AllowBalEntry = { ts: number; allowance?: bigint; bal?: bigint };
const ALLOW_BAL_TTL_MS = 20_000;
const allowBalCache = new Map<string, AllowBalEntry>();

function cacheKey(acct: string, token: string, spender: string) {
  return `${acct.toLowerCase()}:${token.toLowerCase()}:${spender.toLowerCase()}`;
}

export function useLotteryInteraction(lotteryId: string | null, isOpen: boolean) {
  // NOTE: this hook still consumes useLotteryDetails
  const { data, loading, note } = useLotteryDetails(lotteryId, isOpen);

  const account = useActiveAccount();
  const me = account?.address ?? null;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();
  const { fireConfetti } = useConfetti();

  const [nowMs, setNowMs] = useState(Date.now());
  const [tickets, setTickets] = useState("1");
  const [buyMsg, setBuyMsg] = useState<string | null>(null);

  // We keep these for UI display, but we fetch as little as possible.
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
  const emitOptimisticBuy = useCallback(
    (deltaSold: number, patchId?: string) => {
      try {
        if (typeof window === "undefined" || !lotteryId) return;

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

  // ✅ Lottery contract uses your ABI file
  const lotteryContract = useMemo(() => {
    if (!lotteryId) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: lotteryId,
      abi: SINGLE_WINNER_LOTTERY_ABI,
    });
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

  // ✅ USDC contract uses your ABI file
  const usdcContract = useMemo(() => {
    const addr = paymentTokenAddr;
    if (!addr || isZeroAddr(addr)) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: addr,
      abi: USDC_ABI,
    });
  }, [paymentTokenAddr]);

  const isConnected = !!account?.address;

  const lotteryIsOpen =
    (data as any)?.status === "OPEN" &&
    !(data as any)?.paused &&
    !deadlinePassed &&
    !maxReached &&
    (maxTicketsN === 0 || (remainingTickets ?? 0) > 0);

  const hasEnoughAllowance = allowance !== null ? allowance >= totalCostU : false;

  // Only enforce balance check if we actually loaded it.
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= totalCostU : true;

  const allowInFlight = useRef(false);
  const lastAllowFetchAt = useRef(0);

  const refreshAllowance = useCallback(
    async (reason: "open" | "postTx" | "manual" | "preTx" = "manual") => {
      if (!isOpen) return;
      if (!account?.address || !usdcContract || !lotteryId) return;

      const acct = account.address;
      const token = paymentTokenAddr;
      const spender = lotteryId;
      const key = cacheKey(acct, token, spender);

      const now = Date.now();
      const minGap = reason === "postTx" ? 0 : 2500;
      if (now - lastAllowFetchAt.current < minGap) return;

      // Cache hit?
      const hit = allowBalCache.get(key);
      if (hit && now - hit.ts < ALLOW_BAL_TTL_MS) {
        if (typeof hit.allowance === "bigint") setAllowance(hit.allowance);
        if (typeof hit.bal === "bigint") setUsdcBal(hit.bal);
        if (reason === "open") return;
      }

      if (allowInFlight.current) return;
      allowInFlight.current = true;
      lastAllowFetchAt.current = now;

      setAllowLoading(true);

      try {
        // ✅ Use ABI method names (no string signatures)
        const allowanceP = readContract({
          contract: usdcContract,
          method: "allowance",
          params: [acct, spender],
        }).catch(() => 0n as any);

        const shouldReadBalance =
          reason === "manual" ||
          reason === "preTx" ||
          (allowance != null && allowance >= totalCostU && usdcBal == null);

        const balanceP = shouldReadBalance
          ? readContract({
              contract: usdcContract,
              method: "balanceOf",
              params: [acct],
            }).catch(() => null as any)
          : Promise.resolve(null as any);

        const [a, bal] = await Promise.all([allowanceP, balanceP]);

        const aBi = BigInt((a as any) ?? 0n);
        setAllowance(aBi);

        let balBi: bigint | undefined = undefined;
        if (bal != null) {
          balBi = BigInt((bal as any) ?? 0n);
          setUsdcBal(balBi);
        }

        allowBalCache.set(key, { ts: Date.now(), allowance: aBi, bal: balBi ?? hit?.bal });
      } catch {
        setAllowance((prev) => prev ?? null);
        setUsdcBal((prev) => prev ?? null);
      } finally {
        setAllowLoading(false);
        allowInFlight.current = false;
      }
    },
    [isOpen, account?.address, usdcContract, lotteryId, paymentTokenAddr, allowance, usdcBal, totalCostU]
  );

  const approve = useCallback(async () => {
    setBuyMsg(null);

    if (!account?.address || !lotteryId) return;

    if (!usdcContract) {
      setBuyMsg("Payment token unavailable. Please retry.");
      return;
    }

    try {
      await refreshAllowance("preTx");

      // ✅ Use ABI method names
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "approve",
        params: [lotteryId, MaxUint256],
      });

      await sendAndConfirm(tx);

      setBuyMsg("✅ Wallet prepared.");

      // Optimistic set
      setAllowance(MaxUint256);

      void refreshAllowance("postTx");
      emitRevalidate(false);
    } catch {
      setBuyMsg("Prepare wallet failed.");
    }
  }, [account?.address, usdcContract, lotteryId, sendAndConfirm, refreshAllowance, emitRevalidate]);

  const buy = useCallback(async () => {
    setBuyMsg(null);
    if (!account?.address || !lotteryContract || !lotteryId) return;

    try {
      await refreshAllowance("preTx");

      // ✅ Use ABI method names (buyTickets is in SingleWinnerLottery ABI)
      const tx = prepareContractCall({
        contract: lotteryContract,
        method: "buyTickets",
        params: [BigInt(ticketCount)],
      });

      const receipt = await sendAndConfirm(tx);

      const txh = safeTxHash(receipt);
      const patchId = `buy:${lotteryId}:${txh || Date.now()}:${ticketCount}`;

      emitOptimisticBuy(ticketCount, patchId);

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

      // Optimistic local + cache update
      try {
        const acct = account.address;
        const token = paymentTokenAddr;
        const spender = lotteryId;
        const key = cacheKey(acct, token, spender);
        const hit = allowBalCache.get(key);

        const newAllowance = allowance != null ? (allowance > totalCostU ? allowance - totalCostU : 0n) : undefined;
        const newBal = usdcBal != null ? (usdcBal > totalCostU ? usdcBal - totalCostU : 0n) : undefined;

        if (typeof newAllowance === "bigint") setAllowance(newAllowance);
        if (typeof newBal === "bigint") setUsdcBal(newBal);

        allowBalCache.set(key, {
          ts: Date.now(),
          allowance: typeof newAllowance === "bigint" ? newAllowance : hit?.allowance,
          bal: typeof newBal === "bigint" ? newBal : hit?.bal,
        });
      } catch {}

      void refreshAllowance("postTx");
      emitRevalidate(true);
    } catch (e: any) {
      if (String(e).toLowerCase().includes("insufficient")) setBuyMsg("Not enough coins.");
      else setBuyMsg("Purchase failed.");
    }
  }, [
    account?.address,
    lotteryContract,
    lotteryId,
    ticketCount,
    sendAndConfirm,
    fireConfetti,
    refreshAllowance,
    emitRevalidate,
    emitOptimisticBuy,
    data,
    me,
    allowance,
    usdcBal,
    totalCostU,
    paymentTokenAddr,
  ]);

  const handleShare = useCallback(async () => {
    if (!lotteryId) return;

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

    setUsdcBal(null);
    setAllowance(null);

    void refreshAllowance("open");
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