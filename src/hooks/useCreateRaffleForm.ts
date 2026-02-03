// src/hooks/useCreateRaffleForm.ts
import { useState, useMemo, useEffect } from "react";
import { formatUnits, parseUnits } from "ethers";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { ADDRESSES } from "../config/contracts";
import { useFactoryConfig } from "./useFactoryConfig";

// --- Helpers ---
function sanitizeInt(raw: string) { return raw.replace(/[^\d]/g, ""); }
function toInt(raw: string, fallback = 0) {
  const n = Number(sanitizeInt(raw));
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function useCreateRaffleForm(isOpen: boolean, onCreated?: (addr?: string) => void) {
  const account = useActiveAccount();
  const me = account?.address ?? null;
  const { data: configData, loading: configLoading } = useFactoryConfig(isOpen);
  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // --- Form State ---
  const [name, setName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("1");
  const [winningPot, setWinningPot] = useState("100");
  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours" | "days">("hours");
  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState(""); 
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  // --- UI Status ---
  const [msg, setMsg] = useState<string | null>(null);
  const [createdAddr, setCreatedAddr] = useState<string | null>(null);
  const [approvedOnce, setApprovedOnce] = useState(false);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  // --- Contracts ---
  const deployer = useMemo(() => getContract({
    client: thirdwebClient,
    chain: ETHERLINK_CHAIN,
    address: ADDRESSES.SingleWinnerDeployer,
  }), []);

  const usdcContract = useMemo(() => {
    const addr = configData?.usdc || ADDRESSES.USDC;
    if (!addr) return null;
    return getContract({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: addr });
  }, [configData?.usdc]);

  // --- Calculations & Validation ---
  const unitSeconds = durationUnit === "minutes" ? 60 : durationUnit === "hours" ? 3600 : 86400;
  const durationSecondsN = toInt(durationValue, 0) * unitSeconds;
  
  // Parsed BigInts
  const ticketPriceInt = toInt(ticketPrice, 0);
  const winningPotInt = toInt(winningPot, 0);
  const ticketPriceU = useMemo(() => { try { return parseUnits(String(ticketPriceInt), 6); } catch { return 0n; } }, [ticketPriceInt]);
  const winningPotU = useMemo(() => { try { return parseUnits(String(winningPotInt), 6); } catch { return 0n; } }, [winningPotInt]);
  
  const minT = BigInt(Math.max(1, toInt(minTickets, 1)));
  const maxT = BigInt(Math.max(0, toInt(maxTickets, 0))); // 0 = unlimited
  const minPurchaseU32 = Math.max(1, toInt(minPurchaseAmount, 1));

  // Validation Flags
  const isUnlimitedMax = maxTickets.trim() === "" || maxT === 0n;
  const durOk = durationSecondsN >= 300 && durationSecondsN <= 2592000; // 5m to 30d
  const ticketsOk = isUnlimitedMax ? true : maxT >= minT;
  const minPurchaseOk = isUnlimitedMax ? true : BigInt(minPurchaseU32) <= maxT;
  
  const hasEnoughAllowance = allowance !== null ? allowance >= winningPotU : false;
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= winningPotU : true;

  const canSubmit = !!me && !isPending && name.trim().length > 0 && durOk && 
                    ticketPriceInt > 0 && winningPotInt > 0 && minT > 0n &&
                    ticketsOk && minPurchaseOk && hasEnoughAllowance && hasEnoughBalance;

  const needsAllow = !!me && !isPending && !!usdcContract && winningPotU > 0n && !hasEnoughAllowance;

  // --- Actions ---
  const refreshAllowance = async () => {
    if (!isOpen || !me || !usdcContract) return;
    setAllowLoading(true);
    try {
      const [bal, a] = await Promise.all([
        readContract({ contract: usdcContract, method: "function balanceOf(address) view returns (uint256)", params: [me] }),
        readContract({ contract: usdcContract, method: "function allowance(address,address) view returns (uint256)", params: [me, ADDRESSES.SingleWinnerDeployer] }),
      ]);
      setUsdcBal(BigInt(bal as any));
      setAllowance(BigInt(a as any));
    } catch { setUsdcBal(null); setAllowance(null); } 
    finally { setAllowLoading(false); }
  };

  const approve = async () => {
    setMsg(null);
    if (!me || !usdcContract) return;
    try {
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address,uint256) returns (bool)",
        params: [ADDRESSES.SingleWinnerDeployer, winningPotU],
      });
      await sendAndConfirm(tx);
      setApprovedOnce(true);
      setMsg("✅ Approved. Ready to create.");
      refreshAllowance();
    } catch (e) { setMsg("Approval failed or rejected."); }
  };

  const create = async () => {
    setMsg(null);
    if (!canSubmit) return;
    try {
      const tx = prepareContractCall({
        contract: deployer,
        method: "function createSingleWinnerLottery(string,uint256,uint256,uint64,uint64,uint64,uint32) returns (address)",
        params: [name.trim(), ticketPriceU, winningPotU, minT, maxT, BigInt(durationSecondsN), minPurchaseU32],
      });
      const receipt: any = await sendAndConfirm(tx);
      const addr = receipt?.result?.lotteryAddr || receipt?.receipt?.logs?.[0]?.address || "created-id";
      setCreatedAddr(addr);
      setMsg("🎉 Raffle created!");
      onCreated?.(addr);
    } catch (e) { setMsg("Creation failed."); }
  };

  // Reset on open
  useEffect(() => { if (isOpen) { setMsg(null); setCreatedAddr(null); setApprovedOnce(false); refreshAllowance(); } }, [isOpen, me]);

  return {
    form: { 
      name, setName, ticketPrice, setTicketPrice, winningPot, setWinningPot, 
      durationValue, setDurationValue, durationUnit, setDurationUnit,
      minTickets, setMinTickets, maxTickets, setMaxTickets, minPurchaseAmount, setMinPurchaseAmount
    },
    validation: { durOk, ticketsOk, minPurchaseOk, hasEnoughBalance, hasEnoughAllowance, needsAllow, canSubmit, durationSecondsN },
    derived: { ticketPriceU, winningPotU, minT, maxT, me, configData, configLoading },
    status: { msg, isPending, allowLoading, usdcBal, approvedOnce, createdAddr, approve, create },
    helpers: { sanitizeInt } // Export helper to keep UI clean
  };
}
