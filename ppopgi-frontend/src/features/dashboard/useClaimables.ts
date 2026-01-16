// src/features/dashboard/useClaimables.ts
import { useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { LOTTERY_SINGLE_WINNER_ABI } from "../../lib/contracts";

export function useClaimables(raffleId?: string | null) {
  const { address } = useAccount();
  const enabled = !!raffleId && !!address;

  const claimableFundsQ = useReadContract({
    address: (raffleId ?? "0x") as `0x${string}`,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableFunds",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const claimableNativeQ = useReadContract({
    address: (raffleId ?? "0x") as `0x${string}`,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableNative",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const ticketsOwnedQ = useReadContract({
    address: (raffleId ?? "0x") as `0x${string}`,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "ticketsOwned",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  return useMemo(() => {
    const funds = (claimableFundsQ.data as bigint | undefined) ?? 0n;
    const native = (claimableNativeQ.data as bigint | undefined) ?? 0n;
    const tickets = (ticketsOwnedQ.data as bigint | undefined) ?? 0n;

    return {
      funds,
      native,
      tickets,
      isLoading:
        claimableFundsQ.isLoading || claimableNativeQ.isLoading || ticketsOwnedQ.isLoading,
      refetch: () => {
        claimableFundsQ.refetch();
        claimableNativeQ.refetch();
        ticketsOwnedQ.refetch();
      },
    };
  }, [claimableFundsQ, claimableNativeQ, ticketsOwnedQ]);
}