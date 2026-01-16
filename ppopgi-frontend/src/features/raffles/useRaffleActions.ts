// src/features/raffles/useRaffleActions.ts
import { useMemo } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, type Address } from "viem";
import { LOTTERY_SINGLE_WINNER_ABI } from "../../lib/contracts";

const USDC_DECIMALS = 6;
const NATIVE_DECIMALS = 18;

function toAddr(a?: string | null): Address | null {
  if (!a) return null;
  const s = a.toLowerCase();
  return (s.startsWith("0x") ? (s as Address) : null);
}

function fmtUnits(value?: bigint, decimals = 18, maxFrac = 6) {
  if (!value) return "0";
  const s = formatUnits(value, decimals);
  const [a, b] = s.split(".");
  if (!b) return a;
  return `${a}.${b.slice(0, maxFrac)}`.replace(/\.$/, "");
}

export function useRaffleActions({
  raffleId,
  status,
  paused,
}: {
  raffleId: string | null | undefined;
  status?: string;
  paused?: boolean;
}) {
  const { address, isConnected } = useAccount();
  const raffle = toAddr(raffleId);
  const me = toAddr(address ?? null);

  const enabled = isConnected && !!raffle && !!me;

  // Reads
  const ticketsOwnedQ = useReadContract({
    address: raffle ?? undefined,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "ticketsOwned",
    args: me ? [me] : undefined,
    query: { enabled },
  });

  const claimableFundsQ = useReadContract({
    address: raffle ?? undefined,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableFunds",
    args: me ? [me] : undefined,
    query: { enabled },
  });

  const claimableNativeQ = useReadContract({
    address: raffle ?? undefined,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableNative",
    args: me ? [me] : undefined,
    query: { enabled },
  });

  const ticketsOwned = (ticketsOwnedQ.data as bigint | undefined) ?? 0n;
  const claimableFunds = (claimableFundsQ.data as bigint | undefined) ?? 0n;
  const claimableNative = (claimableNativeQ.data as bigint | undefined) ?? 0n;

  const canRefund = useMemo(() => {
    const s = (status ?? "").toUpperCase();
    if (paused) return false;
    return s === "CANCELED" || s === "CANCELLED";
  }, [status, paused]);

  const canClaimUSDC = claimableFunds > 0n;
  const canClaimXTZ = claimableNative > 0n;

  // Writes (one writer; we track last hash for receipt state)
  const { writeContractAsync, data: lastHash, isPending: isWriting, error: writeError } =
    useWriteContract();

  const receiptQ = useWaitForTransactionReceipt({
    hash: lastHash,
    query: { enabled: !!lastHash },
  });

  async function refund() {
    if (!raffle) throw new Error("Missing raffle address");
    return writeContractAsync({
      address: raffle,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "claimTicketRefund",
      args: [],
    });
  }

  async function claimUSDC() {
    if (!raffle) throw new Error("Missing raffle address");
    return writeContractAsync({
      address: raffle,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "withdrawFunds",
      args: [],
    });
  }

  async function collectEnergy() {
    if (!raffle) throw new Error("Missing raffle address");
    return writeContractAsync({
      address: raffle,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "withdrawNative",
      args: [],
    });
  }

  return {
    enabled,

    ticketsOwned,
    claimableFunds,
    claimableNative,

    ticketsOwnedFmt: fmtUnits(ticketsOwned, 0, 0),
    claimableFundsFmt: fmtUnits(claimableFunds, USDC_DECIMALS, 2),
    claimableNativeFmt: fmtUnits(claimableNative, NATIVE_DECIMALS, 4),

    canRefund,
    canClaimUSDC,
    canClaimXTZ,

    refund,
    claimUSDC,
    collectEnergy,

    lastHash,
    isWriting,
    writeError,

    isConfirming: receiptQ.isLoading,
    isConfirmed: !!receiptQ.data,
    receiptError: receiptQ.error,
  };
}