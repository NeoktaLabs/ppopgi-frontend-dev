// src/hooks/useCreateLotteryForm.ts
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { parseUnits } from "ethers";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { ADDRESSES } from "../config/contracts";

function sanitizeInt(raw: string) {
  return String(raw ?? "").replace(/[^\d]/g, "");
}
function toInt(raw: string, fallback = 0) {
  const n = Number(sanitizeInt(raw));
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

// Minimal ERC20 ABI (for typed thirdweb contract)
const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Deployer ABI (typed)
const DEPLOYER_ABI = [
  {
    type: "function",
    name: "createSingleWinnerLottery",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "ticketPrice", type: "uint256" },
      { name: "winningPot", type: "uint256" },
      { name: "minTickets", type: "uint64" },
      { name: "maxTickets", type: "uint64" },
      { name: "durationSeconds", type: "uint64" },
      { name: "minPurchaseAmount", type: "uint32" },
    ],
    outputs: [{ name: "lottery", type: "address" }],
  },
] as const;

// -------------------- App events --------------------

type ActivityDetail = {
  type: "BUY" | "CREATE" | "WIN" | "CANCEL";
  lotteryId: string;
  lotteryName: string;
  subject: string; // creator/buyer/winner
  value: string; // count or pot
  timestamp: string; // seconds
  txHash: string;
  pendingLabel?: string;
};

function emitActivity(detail: ActivityDetail) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ppopgi:activity", { detail }));
  } catch {
    // ignore
  }
}

function emitRevalidate(withDelayedPing = true) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
  } catch {}

  if (!withDelayedPing) return;

  // Delayed ping helps catch up if indexer ingestion is slightly behind.
  try {
    window.setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
      } catch {}
    }, 7000);
  } catch {}
}

// -------------------- Helpers --------------------

function isHexAddressTopic(topic: unknown): topic is string {
  if (typeof topic !== "string") return false;
  // 0x + 64 hex chars (32 bytes)
  return /^0x[0-9a-fA-F]{64}$/.test(topic);
}

function topicToAddress(topic: string): string {
  // last 20 bytes
  return ("0x" + topic.slice(26)).toLowerCase();
}

// -------------------- Hook --------------------

export function useCreateLotteryForm(isOpen: boolean, onCreated?: (addr?: string) => void) {
  const account = useActiveAccount();
  const me = account?.address ?? null;
  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // --- Form State ---
  const [name, setName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("5");
  const [winningPot, setWinningPot] = useState("100");
  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours" | "days">("hours");

  // Limits
  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState(""); // "" => treat as 0 (unlimited)
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  // --- Web3 State ---
  const [msg, setMsg] = useState<string | null>(null);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  // stale-response guard
  const reqIdRef = useRef(0);

  const deployerContract = useMemo(
    () =>
      getContract({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: ADDRESSES.SingleWinnerDeployer,
        abi: DEPLOYER_ABI,
      }),
    []
  );

  const usdcContract = useMemo(
    () =>
      getContract({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: ADDRESSES.USDC,
        abi: ERC20_ABI,
      }),
    []
  );

  // --- Calculations ---
  const unitSeconds = durationUnit === "minutes" ? 60 : durationUnit === "hours" ? 3600 : 86400;
  const durationSecondsN = toInt(durationValue, 0) * unitSeconds;

  const ticketPriceInt = toInt(ticketPrice, 0);
  const winningPotInt = toInt(winningPot, 0);

  const ticketPriceU = useMemo(() => {
    try {
      return parseUnits(String(ticketPriceInt), 6);
    } catch {
      return 0n;
    }
  }, [ticketPriceInt]);

  const winningPotU = useMemo(() => {
    try {
      return parseUnits(String(winningPotInt), 6);
    } catch {
      return 0n;
    }
  }, [winningPotInt]);

  const minT = BigInt(Math.max(1, toInt(minTickets, 1)));
  const maxT = BigInt(Math.max(0, toInt(maxTickets, 0))); // 0 => unlimited
  const minPurchaseU32 = Math.max(1, toInt(minPurchaseAmount, 1));

  // --- Validation ---
  const durOk = durationSecondsN >= 60;
  const hasEnoughAllowance = allowance !== null && allowance >= winningPotU;
  const hasEnoughBalance = usdcBal !== null && usdcBal >= winningPotU;

  const canSubmit =
    !!me &&
    !isPending &&
    name.trim().length > 0 &&
    durOk &&
    winningPotU > 0n &&
    ticketPriceU > 0n &&
    hasEnoughAllowance &&
    hasEnoughBalance;

  // --- Actions ---
  const refreshAllowance = useCallback(async () => {
    if (!isOpen || !me) return;

    const reqId = ++reqIdRef.current;
    setAllowLoading(true);

    try {
      const [bal, a] = await Promise.all([
        readContract({ contract: usdcContract, method: "balanceOf", params: [me] }),
        readContract({
          contract: usdcContract,
          method: "allowance",
          params: [me, ADDRESSES.SingleWinnerDeployer],
        }),
      ]);

      if (reqId !== reqIdRef.current) return;

      setUsdcBal(BigInt(bal ?? 0n));
      setAllowance(BigInt(a ?? 0n));
    } catch (e) {
      console.error("[useCreateLotteryForm] USDC refresh failed", e);
    } finally {
      if (reqId === reqIdRef.current) setAllowLoading(false);
    }
  }, [isOpen, me, usdcContract]);

  // 1) APPROVE
  const approve = async () => {
    setMsg(null);
    if (!me) return;

    try {
      setMsg("Please confirm approval in wallet...");

      const tx = prepareContractCall({
        contract: usdcContract,
        method: "approve",
        params: [ADDRESSES.SingleWinnerDeployer, winningPotU],
      });

      await sendAndConfirm(tx);
      setMsg("Approval successful!");
      await refreshAllowance();

      emitRevalidate(false);
    } catch (e) {
      console.error("[useCreateLotteryForm] approve failed", e);
      setMsg("Approval failed.");
    }
  };

  // 2) CREATE
  const create = async () => {
    setMsg(null);
    if (!canSubmit) return;

    try {
      setMsg("Please confirm creation in wallet...");

      const tx = prepareContractCall({
        contract: deployerContract,
        method: "createSingleWinnerLottery",
        params: [
          name.trim(),
          ticketPriceU,
          winningPotU,
          minT,
          maxT,
          BigInt(durationSecondsN),
          minPurchaseU32,
        ],
      });

      const receipt = await sendAndConfirm(tx);

      // Best-effort: derive new lottery address from logs
      let newAddr = "";
      const logs: any[] = (receipt as any)?.logs ?? [];
      for (const log of logs) {
        const addr = String(log?.address ?? "").toLowerCase();
        if (addr !== ADDRESSES.SingleWinnerDeployer.toLowerCase()) continue;

        const topics: unknown[] = log?.topics ?? [];
        // many factories emit: topic[1] = indexed lottery address
        const t1 = topics[1];
        if (isHexAddressTopic(t1)) {
          newAddr = topicToAddress(t1);
          break;
        }
      }

      // ✅ optimistic ActivityBoard update (immediate UX)
      if (me) {
        const nowSec = Math.floor(Date.now() / 1000);
        const deadlineSec = nowSec + Math.max(0, durationSecondsN);

        emitActivity({
          type: "CREATE",
          lotteryId: (newAddr || "0x").toLowerCase(),
          lotteryName: name.trim() || "New lottery",
          subject: me.toLowerCase(),
          value: winningPotU.toString(), // pot
          timestamp: String(nowSec),
          txHash: String((receipt as any)?.transactionHash ?? `create:${nowSec}:${me}`),
          pendingLabel: "Indexing…",
        });

        // Optional: you can also emit a second optimistic BUY/whatever elsewhere
        // depending on your UX.
        void deadlineSec; // keep computed if you want to use it in UI later
      }

      setMsg("🎉 Success!");
      await refreshAllowance();

      emitRevalidate(true);
      onCreated?.(newAddr || undefined);
    } catch (e) {
      console.error("[useCreateLotteryForm] create failed", e);
      setMsg("Creation failed.");
    }
  };

  // --- Lifecycle ---
  useEffect(() => {
    if (!isOpen) return;

    setMsg(null);
    refreshAllowance();

    const onFocus = () => refreshAllowance();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshAllowance();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    const intervalMs = 15000;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const needs = !hasEnoughAllowance || !hasEnoughBalance;
      if (needs) refreshAllowance();
    }, intervalMs);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(t);
      reqIdRef.current++; // invalidate in-flight
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, me, refreshAllowance, hasEnoughAllowance, hasEnoughBalance]);

  return {
    form: {
      name,
      setName,
      ticketPrice,
      setTicketPrice,
      winningPot,
      setWinningPot,
      durationValue,
      setDurationValue,
      durationUnit,
      setDurationUnit,
      minTickets,
      setMinTickets,
      maxTickets,
      setMaxTickets,
      minPurchaseAmount,
      setMinPurchaseAmount,
    },
    validation: {
      durOk,
      hasEnoughBalance,
      hasEnoughAllowance,
      canSubmit,
      durationSecondsN,
    },
    derived: {
      ticketPriceU,
      winningPotU,
      minT,
      maxT,
      me,
    },
    status: {
      msg,
      isPending,
      allowLoading,
      usdcBal,
      isReady: hasEnoughAllowance,
      approve,
      create,
      refresh: refreshAllowance,
    },
    helpers: { sanitizeInt },
  };
}