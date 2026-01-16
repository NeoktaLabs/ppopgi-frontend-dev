// src/features/raffles/RaffleActionsModal.tsx
import { useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { Coins, Loader2, Ticket, Zap } from "lucide-react";

import { Modal } from "../../ui/Modal";
import { ADDR, ERC20_ABI, LOTTERY_SINGLE_WINNER_ABI } from "../../lib/contracts";
import { txUrl } from "../../lib/explorer";

function fmt(n?: string) {
  if (!n) return "0";
  const [a, b] = n.split(".");
  if (!b) return a;
  return `${a}.${b.slice(0, 2)}`;
}

function fmtBigint(v: bigint | undefined, decimals: number) {
  if (v === undefined) return "0";
  return fmt(formatUnits(v, decimals));
}

export function RaffleActionsModal({
  open,
  onClose,
  raffleId,
}: {
  open: boolean;
  onClose: () => void;
  raffleId: string | null;
}) {
  const enabled = open && !!raffleId;

  const { address, isConnected } = useAccount();

  // Native balance (XTZ on Etherlink)
  const xtzBal = useBalance({
    address,
    query: { enabled: !!address && open },
  });

  // USDC decimals
  const usdcDecimals = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: open },
  });
  const d = Number(usdcDecimals.data ?? 6);

  // Read ticket price from the raffle contract (canonical)
  const ticketPrice = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "ticketPrice",
    query: { enabled },
  });

  // Contract constraint (optional but helpful)
  const minPurchaseAmount = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "minPurchaseAmount",
    query: { enabled },
  });

  // USDC balance + allowance
  const usdcBal = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && open },
  });

  const allowance = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && raffleId ? [address, raffleId] : undefined,
    query: { enabled: !!address && !!raffleId && open },
  });

  // Claimable reads
  const claimableFunds = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableFunds",
    args: address ? [address] : undefined,
    query: { enabled: !!address && enabled },
  });

  const claimableNative = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableNative",
    args: address ? [address] : undefined,
    query: { enabled: !!address && enabled },
  });

  const ticketsOwned = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "ticketsOwned",
    args: address ? [address] : undefined,
    query: { enabled: !!address && enabled },
  });

  // form: ticket count
  const minBuy = Number(minPurchaseAmount.data ?? 1);
  const [countStr, setCountStr] = useState(String(Math.max(1, minBuy)));

  const count = useMemo(() => {
    const n = Math.floor(Number(countStr || "0"));
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  }, [countStr]);

  const totalCost = useMemo(() => {
    const tp = (ticketPrice.data as bigint | undefined) ?? 0n;
    if (!tp || !count) return 0n;
    return tp * BigInt(count);
  }, [ticketPrice.data, count]);

  const usdcBalBn = (usdcBal.data as bigint | undefined) ?? 0n;
  const allowanceBn = (allowance.data as bigint | undefined) ?? 0n;

  const hasAllowance = allowanceBn >= totalCost && totalCost > 0n;
  const hasBalance = usdcBalBn >= totalCost && totalCost > 0n;

  // txs
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const tx = useWaitForTransactionReceipt({ hash });

  const busy = isPending || tx.isLoading;

  async function doApprove() {
    if (!raffleId) return;
    // Approve exactly what we need (simple + safer). User can re-approve later.
    await writeContractAsync({
      address: ADDR.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [raffleId, totalCost],
    });
  }

  async function doBuy() {
    if (!raffleId) return;
    await writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "buyTickets",
      args: [BigInt(count)],
    });
  }

  async function doClaimUSDC() {
    if (!raffleId) return;
    await writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "withdrawFunds",
      args: [],
    });
  }

  async function doClaimXTZ() {
    if (!raffleId) return;
    await writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "withdrawNative",
      args: [],
    });
  }

  async function doRefund() {
    if (!raffleId) return;
    await writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "claimTicketRefund",
      args: [],
    });
  }

  const canBuyCount = count >= minBuy;
  const canApprove = enabled && isConnected && totalCost > 0n && !hasAllowance && !busy;
  const canBuy = enabled && isConnected && canBuyCount && hasAllowance && hasBalance && !busy;

  const canClaimUSDC =
    enabled && isConnected && ((claimableFunds.data as bigint | undefined) ?? 0n) > 0n && !busy;
  const canClaimXTZ =
    enabled && isConnected && ((claimableNative.data as bigint | undefined) ?? 0n) > 0n && !busy;

  const canRefund =
    enabled && isConnected && ((ticketsOwned.data as bigint | undefined) ?? 0n) > 0n && !busy;

  return (
    <Modal open={open} onClose={onClose} title="Actions">
      {!raffleId ? (
        <div className="font-black text-gray-800">No raffle selected.</div>
      ) : !isConnected ? (
        <div className="font-black text-gray-800">Connect your wallet to use actions.</div>
      ) : (
        <div className="grid gap-4">
          {/* Balances */}
          <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
            <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
              Your balances
            </div>

            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
                <div className="flex items-center gap-2 font-black text-gray-900">
                  <Zap size={16} className="text-green-600" /> Energy (XTZ)
                </div>
                <div className="font-black text-gray-900">
                  {xtzBal.data ? fmt(xtzBal.data.formatted) : "…"} XTZ
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
                <div className="flex items-center gap-2 font-black text-gray-900">
                  <Coins size={16} className="text-amber-600" /> Entry (USDC)
                </div>
                <div className="font-black text-gray-900">
                  {fmtBigint(usdcBalBn, d)} USDC
                </div>
              </div>
            </div>
          </div>

          {/* Buy tickets */}
          <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
                  Buy tickets
                </div>
                <div className="mt-1 text-base font-black text-gray-900 flex items-center gap-2">
                  Join raffle <Ticket size={16} />
                </div>
                <div className="mt-1 text-xs font-bold text-gray-700/80">
                  Ticket price is read from the raffle contract.
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                  Ticket
                </div>
                <div className="font-black text-gray-900">
                  {ticketPrice.data ? fmtBigint(ticketPrice.data as bigint, d) : "…"} USDC
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
                <div className="text-sm font-black text-gray-900">Count</div>
                <input
                  value={countStr}
                  onChange={(e) => setCountStr(e.target.value)}
                  inputMode="numeric"
                  className="w-28 text-right px-3 py-2 rounded-xl border border-gray-200 bg-white font-black text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/60"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-gray-700 px-1">
                <span>Minimum buy</span>
                <span className="font-black">{minBuy}</span>
              </div>

              <div className="flex items-center justify-between text-sm font-black text-gray-900 px-1">
                <span>Total</span>
                <span>{fmtBigint(totalCost, d)} USDC</span>
              </div>

              {!canBuyCount ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs font-bold text-amber-900">
                  Count must be at least {minBuy}.
                </div>
              ) : !hasBalance && totalCost > 0n ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs font-bold text-amber-900">
                  Not enough USDC balance for this purchase.
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={doApprove}
                  disabled={!canApprove}
                  className={[
                    "w-full rounded-2xl px-4 py-3 font-black shadow-lg transition-all border border-white/60",
                    canApprove
                      ? "bg-white/80 hover:bg-white text-gray-900"
                      : "bg-white/30 text-gray-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} /> Working…
                    </span>
                  ) : hasAllowance ? (
                    "Approved"
                  ) : (
                    "Approve USDC"
                  )}
                </button>

                <button
                  type="button"
                  onClick={doBuy}
                  disabled={!canBuy}
                  className={[
                    "w-full rounded-2xl px-4 py-3 font-black shadow-lg transition-all border border-white/60",
                    canBuy
                      ? "bg-amber-500 hover:bg-amber-600 text-white active:translate-y-0.5"
                      : "bg-white/30 text-gray-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} /> Working…
                    </span>
                  ) : (
                    "Buy tickets"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Claims + refunds */}
          <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
            <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
              Claims & refunds
            </div>

            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
                <div className="text-sm font-black text-gray-900">Claimable USDC</div>
                <div className="font-black text-gray-900">
                  {fmtBigint((claimableFunds.data as bigint | undefined) ?? 0n, d)} USDC
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
                <div className="text-sm font-black text-gray-900">Claimable XTZ</div>
                <div className="font-black text-gray-900">
                  {formatUnits(((claimableNative.data as bigint | undefined) ?? 0n), 18)} XTZ
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
                <div className="text-sm font-black text-gray-900">Tickets owned</div>
                <div className="font-black text-gray-900">
                  {String((ticketsOwned.data as bigint | undefined) ?? 0n)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={doClaimUSDC}
                  disabled={!canClaimUSDC}
                  className={[
                    "rounded-2xl px-4 py-3 font-black shadow-lg transition-all border border-white/60",
                    canClaimUSDC
                      ? "bg-gray-900 hover:bg-gray-800 text-white"
                      : "bg-white/30 text-gray-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  Claim USDC
                </button>

                <button
                  type="button"
                  onClick={doClaimXTZ}
                  disabled={!canClaimXTZ}
                  className={[
                    "rounded-2xl px-4 py-3 font-black shadow-lg transition-all border border-white/60",
                    canClaimXTZ
                      ? "bg-gray-900 hover:bg-gray-800 text-white"
                      : "bg-white/30 text-gray-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  Claim XTZ
                </button>

                <button
                  type="button"
                  onClick={doRefund}
                  disabled={!canRefund}
                  className={[
                    "rounded-2xl px-4 py-3 font-black shadow-lg transition-all border border-white/60",
                    canRefund
                      ? "bg-white/80 hover:bg-white text-gray-900"
                      : "bg-white/30 text-gray-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  Refund
                </button>
              </div>
            </div>
          </div>

          {/* Tx status */}
          {hash ? (
            <a
              href={txUrl(String(hash))}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-white/70 border border-white/60 p-3 text-xs font-black text-blue-700 hover:underline"
            >
              {tx.isLoading ? "Transaction pending…" : tx.isSuccess ? "Transaction confirmed" : "Transaction sent"} — View on explorer
            </a>
          ) : null}
        </div>
      )}
    </Modal>
  );
}