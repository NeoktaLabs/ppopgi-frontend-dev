// src/features/dashboard/useRaffleActions.ts
import { useMemo } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { isAddress, formatUnits } from "viem";

import { ADDR, ERC20_ABI, LOTTERY_SINGLE_WINNER_ABI } from "../../lib/contracts";

const NATIVE_DECIMALS = 18;

function safeBigint(v: unknown): bigint {
  try {
    if (typeof v === "bigint") return v;
    return BigInt(String(v ?? "0"));
  } catch {
    return 0n;
  }
}

export function useRaffleActions(raffleId?: string | null) {
  const { address, isConnected } = useAccount();
  const enabled = isConnected && !!address && !!raffleId && isAddress(String(raffleId));

  // USDC decimals
  const usdcDecimals = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: true },
  });
  const usdcD = Number(usdcDecimals.data ?? 6);

  // Reads from raffle
  const ticketsOwnedQ = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "ticketsOwned",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const claimableFundsQ = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableFunds",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const claimableNativeQ = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableNative",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const ticketsOwned = safeBigint(ticketsOwnedQ.data);
  const claimableUSDC = safeBigint(claimableFundsQ.data);
  const claimableXTZ = safeBigint(claimableNativeQ.data);

  const fmt = useMemo(() => {
    return {
      ticketsOwned: ticketsOwned.toString(),
      claimableUSDC: formatUnits(claimableUSDC, usdcD),
      claimableXTZ: formatUnits(claimableXTZ, NATIVE_DECIMALS),
    };
  }, [ticketsOwned, claimableUSDC, claimableXTZ, usdcD]);

  // Writes
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const tx = useWaitForTransactionReceipt({ hash: txHash });

  const busy = isPending || tx.isLoading;

  async function claimUSDC() {
    if (!enabled) return;
    return writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "withdrawFunds",
      args: [],
    } as any);
  }

  async function claimXTZ() {
    if (!enabled) return;
    return writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "withdrawNative",
      args: [],
    } as any);
  }

  async function refundTickets() {
    if (!enabled) return;
    return writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "claimTicketRefund",
      args: [],
    } as any);
  }

  const canClaimUSDC = enabled && claimableUSDC > 0n && !busy;
  const canClaimXTZ = enabled && claimableXTZ > 0n && !busy;
  const canRefund = enabled && ticketsOwned > 0n && !busy;

  return {
    enabled,
    address,

    ticketsOwned,
    claimableUSDC,
    claimableXTZ,
    fmt,

    canClaimUSDC,
    canClaimXTZ,
    canRefund,

    claimUSDC,
    claimXTZ,
    refundTickets,

    txHash,
    tx,
    busy,

    // raw queries if needed
    ticketsOwnedQ,
    claimableFundsQ,
    claimableNativeQ,
  };
}