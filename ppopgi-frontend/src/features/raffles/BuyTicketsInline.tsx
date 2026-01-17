import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { Loader2 } from "lucide-react";

import { ADDR, ERC20_ABI, LOTTERY_SINGLE_WINNER_ABI } from "../../lib/contracts";

type Props = {
  raffleId: string;
  ticketPrice: bigint; // from subgraph
  status: string;
  paused?: boolean;
  endedByTime?: boolean;
};

// ✅ hard cap to avoid UX / approval abuse
const MAX_QTY = 100;

export function BuyTicketsInline({
  raffleId,
  ticketPrice,
  status,
  paused,
  endedByTime,
}: Props) {
  const { address, isConnected } = useAccount();

  const [qty, setQty] = useState<number>(1);

  const enabled =
    isConnected &&
    !!raffleId &&
    status === "OPEN" &&
    !paused &&
    !endedByTime;

  // --- total cost ---
  const totalCost = useMemo(
    () => ticketPrice * BigInt(qty),
    [ticketPrice, qty]
  );

  // --- allowance ---
  const allowanceQ = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, raffleId] : undefined,
    query: { enabled },
  });

  const allowance = allowanceQ.data ?? 0n;
  const needsApproval = allowance < totalCost;

  // --- approve ---
  const {
    writeContractAsync: approveAsync,
    data: approveHash,
    isPending: approving,
  } = useWriteContract();

  const approveTx = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  async function approve() {
    await approveAsync({
      address: ADDR.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [raffleId, totalCost],
    });
  }

  // --- buy ---
  const {
    writeContractAsync: buyAsync,
    data: buyHash,
    isPending: buying,
  } = useWriteContract();

  const buyTx = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  async function buy() {
    await buyAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "buyTickets",
      args: [BigInt(qty)],
    });
  }

  const busy =
    approving ||
    buying ||
    approveTx.isLoading ||
    buyTx.isLoading;

  // --- reset qty after success ---
  useEffect(() => {
    if (buyTx.isSuccess) setQty(1);
  }, [buyTx.isSuccess]);

  if (!enabled) {
    return (
      <div className="text-xs font-bold opacity-70">
        Buying unavailable
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      {/* Qty */}
      <input
        type="number"
        min={1}
        max={MAX_QTY}
        value={qty}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          setQty(Math.min(MAX_QTY, Math.max(1, n)));
        }}
        className="w-16 rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm font-black text-gray-900"
      />

      {/* Cost */}
      <div className="whitespace-nowrap text-xs font-black opacity-80">
        {formatUnits(totalCost, 6)} USDC
      </div>

      {/* Action */}
      {needsApproval ? (
        <button
          type="button"
          onClick={approve}
          disabled={busy}
          className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Approve"}
        </button>
      ) : (
        <button
          type="button"
          onClick={buy}
          disabled={busy}
          className="rounded-xl bg-gray-900 hover:bg-gray-800 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Buy"}
        </button>
      )}
    </div>
  );
}