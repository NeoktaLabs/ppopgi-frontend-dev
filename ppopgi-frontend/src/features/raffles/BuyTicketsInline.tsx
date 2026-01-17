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
  ticketPrice: bigint; // from subgraph (USDC 6 decimals)
  status: string; // expected "OPEN"
  paused?: boolean;
  endedByTime?: boolean;
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function BuyTicketsInline({
  raffleId,
  ticketPrice,
  status,
  paused,
  endedByTime,
}: Props) {
  const { address, isConnected } = useAccount();

  const [qty, setQty] = useState<number>(1);
  const [msg, setMsg] = useState<string | null>(null);

  const enabled =
    isConnected && !!address && !!raffleId && status === "OPEN" && !paused && !endedByTime;

  // --- contract max batch (optional but recommended) ---
  const maxBatchQ = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "MAX_BATCH_BUY",
    query: { enabled },
  });

  const maxBatch = useMemo(() => {
    const v = maxBatchQ.data;
    const n = typeof v === "bigint" ? Number(v) : Number(v ?? 50);
    // fallback to 50 if not readable
    return Number.isFinite(n) && n > 0 ? n : 50;
  }, [maxBatchQ.data]);

  // keep qty always valid even if maxBatch loads late
  useEffect(() => {
    setQty((q) => clampInt(q, 1, maxBatch));
  }, [maxBatch]);

  // --- total cost ---
  const totalCost = useMemo(() => {
    const q = clampInt(qty, 1, maxBatch);
    return ticketPrice * BigInt(q);
  }, [ticketPrice, qty, maxBatch]);

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

  const approveTx = useWaitForTransactionReceipt({ hash: approveHash });

  async function approve() {
    setMsg(null);
    try {
      await approveAsync({
        address: ADDR.usdc,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [raffleId, totalCost],
      });
    } catch (e: any) {
      setMsg(e?.shortMessage || e?.message || "Approval failed.");
    }
  }

  // --- buy ---
  const {
    writeContractAsync: buyAsync,
    data: buyHash,
    isPending: buying,
  } = useWriteContract();

  const buyTx = useWaitForTransactionReceipt({ hash: buyHash });

  async function buy() {
    setMsg(null);

    // last-second safety guard (UI-side)
    if (!enabled) {
      setMsg("Buying just closed.");
      return;
    }

    try {
      await buyAsync({
        address: raffleId as any,
        abi: LOTTERY_SINGLE_WINNER_ABI,
        functionName: "buyTickets",
        args: [BigInt(clampInt(qty, 1, maxBatch))],
      });
    } catch (e: any) {
      const m = (e?.shortMessage || e?.message || "").toLowerCase();
      if (m.includes("lotteryexpired") || m.includes("expired")) {
        setMsg("Too late — raffle just ended.");
      } else if (m.includes("lotterynotopen") || m.includes("not open")) {
        setMsg("Raffle is not open.");
      } else if (m.includes("ticketlimitreached")) {
        setMsg("Sold out.");
      } else if (m.includes("batchtoolarge") || m.includes("too large")) {
        setMsg(`Max ${maxBatch} tickets per purchase.`);
      } else {
        setMsg(e?.shortMessage || e?.message || "Transaction failed.");
      }
    }
  }

  const busy = approving || buying || approveTx.isLoading || buyTx.isLoading;

  // --- after approval confirms, refetch allowance so button flips to "Buy" instantly ---
  useEffect(() => {
    if (approveTx.isSuccess) allowanceQ.refetch?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveTx.isSuccess]);

  // --- reset qty after success ---
  useEffect(() => {
    if (buyTx.isSuccess) {
      setQty(1);
      allowanceQ.refetch?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyTx.isSuccess]);

  // parent already hides it; this prevents “Buying unavailable” clutter
  if (!enabled) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        {/* Qty */}
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          type="number"
          min={1}
          max={maxBatch}
          value={qty}
          onChange={(e) => {
            const next = Number(e.target.value);
            setQty(clampInt(next || 1, 1, maxBatch));
          }}
          className="w-16 rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm font-black text-gray-900"
          aria-label="Ticket quantity"
        />

        {/* Cost */}
        <div className="text-xs font-black opacity-80 whitespace-nowrap">
          {formatUnits(totalCost, 6)} USDC
        </div>

        {/* Action */}
        {needsApproval ? (
          <button
            type="button"
            onClick={approve}
            disabled={busy || totalCost <= 0n}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Approve"}
          </button>
        ) : (
          <button
            type="button"
            onClick={buy}
            disabled={busy || totalCost <= 0n}
            className="rounded-xl bg-gray-900 hover:bg-gray-800 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Buy"}
          </button>
        )}
      </div>

      {/* Message */}
      {msg ? <div className="mt-2 text-[11px] font-bold opacity-80">{msg}</div> : null}

      {/* Small helper */}
      <div className="mt-1 text-[10px] font-bold opacity-60">
        Max {maxBatch} per purchase
      </div>
    </div>
  );
}