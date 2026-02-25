// src/hooks/useCreateLotteryForm.ts
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { parseUnits } from "ethers";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { ADDRESSES } from "../config/contracts";

/* -------------------- utils -------------------- */

function sanitizeInt(raw: string) {
  return String(raw ?? "").replace(/[^\d]/g, "");
}
function toInt(raw: string, fallback = 0) {
  const n = Number(sanitizeInt(raw));
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

/* -------------------- minimal ABIs -------------------- */

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

/* -------------------- app events -------------------- */

type ActivityDetail = {
  type: "BUY" | "CREATE" | "WIN" | "CANCEL";
  lotteryId: string;
  lotteryName: string;
  subject: string;
  value: string;
  timestamp: string;
  txHash: string;
  pendingLabel?: string;
};

function emitActivity(detail: ActivityDetail) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ppopgi:activity", { detail }));
  } catch {}
}

function emitRevalidate(withDelayedPing = true) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
  } catch {}

  if (!withDelayedPing) return;

  try {
    window.setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent("ppopgi:revalidate"));
      } catch {}
    }, 7000);
  } catch {}
}

function emitOptimistic(detail: any) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ppopgi:optimistic", { detail }));
  } catch {}
}

/* -------------------- helpers -------------------- */

function isHexAddressTopic(topic: unknown): topic is string {
  if (typeof topic !== "string") return false;
  return /^0x[0-9a-fA-F]{64}$/.test(topic);
}

function topicToAddress(topic: string): string {
  return ("0x" + topic.slice(26)).toLowerCase();
}

/* -------------------- hook -------------------- */

type AllowanceSnapshot = { bal: bigint; allowance: bigint; ts: number };

const SNAPSHOT_TTL_MS = 12_000; // small TTL: prevents spam when typing or re-opening quickly

export function useCreateLotteryForm(isOpen: boolean, onCreated?: (addr?: string) => void) {
  const account = useActiveAccount();
  const me = account?.address ?? null;
  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  /* ---------- form state ---------- */

  const [name, setName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("5");
  const [winningPot, setWinningPot] = useState("100");
  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours" | "days">("hours");

  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState("");
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  /* ---------- web3 state ---------- */

  const [msg, setMsg] = useState<string | null>(null);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  // request guard + TTL snapshot
  const reqIdRef = useRef(0);
  const lastSnapRef = useRef<AllowanceSnapshot | null>(null);

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

  /* ---------- calculations ---------- */

  const unitSeconds = durationUnit === "minutes" ? 60 : durationUnit === "hours" ? 3600 : 86400;
  const durationSecondsN = toInt(durationValue, 0) * unitSeconds;

  const ticketPriceU = useMemo(() => parseUnits(String(toInt(ticketPrice, 0)), 6), [ticketPrice]);
  const winningPotU = useMemo(() => parseUnits(String(toInt(winningPot, 0)), 6), [winningPot]);

  const minT = BigInt(Math.max(1, toInt(minTickets, 1)));
  const maxT = BigInt(Math.max(0, toInt(maxTickets, 0)));
  const minPurchaseU32 = Math.max(1, toInt(minPurchaseAmount, 1));

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

  /* ---------- allowance/balance refresh ---------- */

  const refreshAllowance = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!isOpen || !me) return;

      // TTL: avoid re-fetching if we just fetched
      const snap = lastSnapRef.current;
      if (!opts.force && snap && Date.now() - snap.ts < SNAPSHOT_TTL_MS) {
        setUsdcBal(snap.bal);
        setAllowance(snap.allowance);
        return;
      }

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

        const balB = BigInt(bal ?? 0n);
        const allowB = BigInt(a ?? 0n);

        lastSnapRef.current = { bal: balB, allowance: allowB, ts: Date.now() };
        setUsdcBal(balB);
        setAllowance(allowB);
      } finally {
        if (reqId === reqIdRef.current) setAllowLoading(false);
      }
    },
    [isOpen, me, usdcContract]
  );

  /* ---------- approve ---------- */

  const approve = async () => {
    setMsg(null);
    if (!me) return;

    try {
      setMsg("Confirm approval in wallet...");
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "approve",
        params: [ADDRESSES.SingleWinnerDeployer, winningPotU],
      });

      await sendAndConfirm(tx);
      setMsg("Approval successful!");

      // force refresh to reflect new allowance immediately
      await refreshAllowance({ force: true });

      emitRevalidate(false);
    } catch {
      setMsg("Approval failed.");
    }
  };

  /* ---------- create ---------- */

  const create = async () => {
    setMsg(null);
    if (!canSubmit) return;

    try {
      setMsg("Confirm creation in wallet...");

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

      let newAddr = "";
      const logs: any[] = (receipt as any)?.logs ?? [];
      for (const log of logs) {
        const addr = String(log?.address ?? "").toLowerCase();
        if (addr !== ADDRESSES.SingleWinnerDeployer.toLowerCase()) continue;

        const t1 = log?.topics?.[1];
        if (isHexAddressTopic(t1)) {
          newAddr = topicToAddress(t1);
          break;
        }
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const txHash = String((receipt as any)?.transactionHash ?? `create:${nowSec}:${me}`);

      emitOptimistic({
        kind: "CREATE",
        patchId: txHash,
        tsMs: Date.now(),
        lottery: {
          id: (newAddr || "0x").toLowerCase(),
          name: name.trim(),
          creator: me?.toLowerCase(),
          status: "OPEN",
          typeId: "1",
          registeredAt: String(nowSec),
          ticketPrice: ticketPriceU.toString(),
          winningPot: winningPotU.toString(),
          minTickets: String(minT),
          maxTickets: String(maxT),
          minPurchaseAmount: String(minPurchaseU32),
          deadline: String(nowSec + durationSecondsN),
          usdcToken: ADDRESSES.USDC.toLowerCase(),
        },
      });

      emitActivity({
        type: "CREATE",
        lotteryId: (newAddr || "0x").toLowerCase(),
        lotteryName: name.trim(),
        subject: me?.toLowerCase() ?? "",
        value: winningPotU.toString(),
        timestamp: String(nowSec),
        txHash,
        pendingLabel: "Indexing…",
      });

      setMsg("🎉 Success!");

      // After create, balance may have changed; refresh once (forced)
      await refreshAllowance({ force: true });

      emitRevalidate(true);
      onCreated?.(newAddr || undefined);
    } catch {
      setMsg("Creation failed.");
    }
  };

  /* ---------- lifecycle (NO POLLING) ---------- */

  // 1) initial load when modal opens or account changes
  useEffect(() => {
    if (!isOpen) return;
    refreshAllowance({ force: true });
    return () => {
      reqIdRef.current++;
    };
  }, [isOpen, me, refreshAllowance]);

  // 2) refresh when tab becomes visible again (prevents stale modal)
  useEffect(() => {
    if (!isOpen) return;

    const onVis = () => {
      if (document.visibilityState === "visible") refreshAllowance({ force: false });
    };

    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isOpen, refreshAllowance]);

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
    derived: { ticketPriceU, winningPotU, minT, maxT, me },
    status: { msg, isPending, allowLoading, usdcBal, approve, create, refresh: refreshAllowance },
    helpers: { sanitizeInt },
  };
}