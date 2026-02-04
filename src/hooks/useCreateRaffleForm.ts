// src/hooks/useCreateRaffleForm.ts
import { useState, useMemo, useEffect, useCallback } from "react";
import { parseUnits } from "ethers";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { ADDRESSES } from "../config/contracts";

function sanitizeInt(raw: string) { return raw.replace(/[^\d]/g, ""); }
function toInt(raw: string, fallback = 0) {
  const n = Number(sanitizeInt(raw));
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function useCreateRaffleForm(isOpen: boolean, onCreated?: (addr?: string) => void) {
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
  const [maxTickets, setMaxTickets] = useState(""); 
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  // --- Web3 State ---
  const [msg, setMsg] = useState<string | null>(null);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  // --- Contracts ---
  const factoryContract = useMemo(() => getContract({
    client: thirdwebClient,
    chain: ETHERLINK_CHAIN,
    address: ADDRESSES.SingleWinnerDeployer,
  }), []);

  const usdcContract = useMemo(() => getContract({ 
    client: thirdwebClient, 
    chain: ETHERLINK_CHAIN, 
    address: ADDRESSES.USDC 
  }), []);

  // --- Calculations ---
  const unitSeconds = durationUnit === "minutes" ? 60 : durationUnit === "hours" ? 3600 : 86400;
  const durationSecondsN = toInt(durationValue, 0) * unitSeconds;
  
  const ticketPriceInt = toInt(ticketPrice, 0);
  const winningPotInt = toInt(winningPot, 0);
  
  const ticketPriceU = useMemo(() => { try { return parseUnits(String(ticketPriceInt), 6); } catch { return 0n; } }, [ticketPriceInt]);
  const winningPotU = useMemo(() => { try { return parseUnits(String(winningPotInt), 6); } catch { return 0n; } }, [winningPotInt]);
  
  const minT = BigInt(Math.max(1, toInt(minTickets, 1)));
  const maxT = BigInt(Math.max(0, toInt(maxTickets, 0))); 
  const minPurchaseU32 = Math.max(1, toInt(minPurchaseAmount, 1));

  // --- Validation ---
  const durOk = durationSecondsN >= 60; // Min 1 min
  
  const hasEnoughAllowance = allowance !== null && allowance >= winningPotU;
  const hasEnoughBalance = usdcBal !== null && usdcBal >= winningPotU;

  const canSubmit = !!me && !isPending && name.trim().length > 0 && durOk && 
                    winningPotU > 0n && ticketPriceU > 0n && 
                    hasEnoughAllowance && hasEnoughBalance;

  // --- Actions ---
  const refreshAllowance = useCallback(async () => {
    if (!isOpen || !me || !usdcContract) return;
    setAllowLoading(true);
    try {
      const [bal, a] = await Promise.all([
        readContract({ contract: usdcContract, method: "function balanceOf(address) view returns (uint256)", params: [me] }),
        readContract({ contract: usdcContract, method: "function allowance(address,address) view returns (uint256)", params: [me, ADDRESSES.SingleWinnerDeployer] }),
      ]);
      setUsdcBal(BigInt(bal as any));
      setAllowance(BigInt(a as any));
    } catch (e) {
      console.error("Refresh failed", e);
    } finally { 
      setAllowLoading(false); 
    }
  }, [isOpen, me, usdcContract]);

  // 1. APPROVE
  const approve = async () => {
    setMsg(null);
    if (!me || !usdcContract) return;
    try {
      setMsg("Please confirm approval in wallet...");
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address,uint256) returns (bool)",
        params: [ADDRESSES.SingleWinnerDeployer, winningPotU],
      });
      await sendAndConfirm(tx);
      setMsg("Approval successful!");
      await refreshAllowance(); 
    } catch (e) { 
      console.error("Approve failed", e);
      setMsg("Approval failed."); 
    }
  };

  // 2. CREATE
  const create = async () => {
    setMsg(null);
    if (!canSubmit) return;
    try {
      setMsg("Please confirm creation in wallet...");
      
      const tx = prepareContractCall({
        contract: factoryContract,
        method: "function createSingleWinnerLottery(string,uint256,uint256,uint64,uint64,uint64,uint32) returns (address)",
        params: [
          name.trim(), 
          ticketPriceU, 
          winningPotU, 
          minT, 
          maxT, 
          BigInt(durationSecondsN), 
          minPurchaseU32
        ],
      });

      const receipt = await sendAndConfirm(tx);
      
      // ✅ FIX: Find the new address from logs
      // The factory emits RaffleCreated(address indexed raffle, address indexed creator)
      // We look for the log emitted by the factory address
      let newAddr = "";
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
           if (log.address.toLowerCase() === ADDRESSES.SingleWinnerDeployer.toLowerCase()) {
              // The first topic is the event signature, the second (index 1) is the raffle address
              if (log.topics && log.topics[1]) {
                 newAddr = "0x" + log.topics[1].slice(26); // Remove padding
              }
           }
        }
      }

      setMsg("🎉 Success!");
      if (onCreated) onCreated(newAddr);

    } catch (e) { 
      console.error("Create failed", e);
      setMsg("Creation failed."); 
    }
  };

  // Poll for allowance updates while open
  useEffect(() => { 
    if (isOpen && me) { 
      setMsg(null); 
      refreshAllowance();
      const t = setInterval(refreshAllowance, 5000); 
      return () => clearInterval(t);
    } 
  }, [isOpen, me, refreshAllowance]);

  return {
    form: { 
      name, setName, ticketPrice, setTicketPrice, winningPot, setWinningPot, 
      durationValue, setDurationValue, durationUnit, setDurationUnit,
      minTickets, setMinTickets, maxTickets, setMaxTickets, 
      minPurchaseAmount, setMinPurchaseAmount
    },
    validation: { 
      durOk, hasEnoughBalance, hasEnoughAllowance, canSubmit, durationSecondsN 
    },
    derived: { 
      ticketPriceU, winningPotU, minT, maxT, me, 
      configData: { feeRecipient: ADDRESSES.SingleWinnerDeployer, protocolFeePercent: 5 }
    },
    status: { 
      msg, isPending, allowLoading, usdcBal, 
      // ✅ VITAL: UI uses this to disable the "Approve" button
      isReady: hasEnoughAllowance, 
      approve, create 
    },
    helpers: { sanitizeInt }
  };
}
