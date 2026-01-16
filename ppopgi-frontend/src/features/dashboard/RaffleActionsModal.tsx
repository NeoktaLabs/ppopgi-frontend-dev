// src/features/dashboard/RaffleActionsModal.tsx
import React, { useMemo, useState } from "react";
import { Modal } from "../../ui/Modal";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import {
  Coins,
  Wallet,
  ArrowDownCircle,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
} from "lucide-react";

import { ADDR, ERC20_ABI, LOTTERY_SINGLE_WINNER_ABI } from "../../lib/contracts";
import { addrUrl, txUrl } from "../../lib/explorer";

function shortAddr(a?: string | null) {
  if (!a) return "—";
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function safeBigint(v: unknown): bigint {
  try {
    return typeof v === "bigint" ? v : BigInt(v as any);
  } catch {
    return 0n;
  }
}

function fmt(v: bigint, decimals: number, maxFrac = 6) {
  const s = formatUnits(v, decimals);
  // trim to maxFrac without rounding complexity (good enough for UI)
  const [i, f] = s.split(".");
  if (!f) return i;
  return `${i}.${f.slice(0, maxFrac)}`.replace(/\.$/, "");
}

export function RaffleActionsModal({
  open,
  onClose,
  raffleId,
  raffleName,
}: {
  open: boolean;
  onClose: () => void;
  raffleId: string; // pass "" when not set
  raffleName?: string | null;
}) {
  const { address, isConnected } = useAccount();

  const enabled = open && !!raffleId && isConnected && !!address;

  // --- decimals ---
  const usdcDecimalsQ = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: open },
  });
  const usdcDecimals = Number(usdcDecimalsQ.data ?? 6);
  const xtzDecimals = 18;

  // --- user state on this raffle ---
  const qTicketsOwned = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "ticketsOwned",
    args: [address as any],
    query: { enabled },
  });

  const qClaimableUSDC = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableFunds",
    args: [address as any],
    query: { enabled },
  });

  const qClaimableXTZ = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableNative",
    args: [address as any],
    query: { enabled },
  });

  const ticketsOwned = safeBigint(qTicketsOwned.data);
  const claimableUSDC = safeBigint(qClaimableUSDC.data);
  const claimableXTZ = safeBigint(qClaimableXTZ.data);

  const display = useMemo(() => {
    return {
      tickets: ticketsOwned.toString(),
      usdc: fmt(claimableUSDC, usdcDecimals, 6),
      xtz: fmt(claimableXTZ, xtzDecimals, 6),
    };
  }, [ticketsOwned, claimableUSDC, claimableXTZ, usdcDecimals]);

  // --- write ---
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const tx = useWaitForTransactionReceipt({ hash: txHash });

  const [action, setAction] = useState<"refund" | "withdrawUSDC" | "withdrawXTZ" | null>(null);
  const busy = isPending || tx.isLoading;

  async function runRefund() {
    setAction("refund");
    await writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "claimTicketRefund",
      args: [],
    });
  }

  async function runWithdrawUSDC() {
    setAction("withdrawUSDC");
    await writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "withdrawFunds",
      args: [],
    });
  }

  async function runWithdrawXTZ() {
    setAction("withdrawXTZ");
    await writeContractAsync({
      address: raffleId as any,
      abi: LOTTERY_SINGLE_WINNER_ABI,
      functionName: "withdrawNative",
      args: [],
    });
  }

  const canRefund = enabled && !busy && ticketsOwned > 0n;
  const canWithdrawUSDC = enabled && !busy && claimableUSDC > 0n;
  const canWithdrawXTZ = enabled && !busy && claimableXTZ > 0n;

  const title = raffleName ? `Manage • ${raffleName}` : "Manage";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {!raffleId ? (
        <div className="font-bold text-gray-700">Select a raffle first.</div>
      ) : !isConnected ? (
        <div className="font-black text-gray-800">Connect your wallet to manage.</div>
      ) : (
        <div className="grid gap-4">
          {/* Header */}
          <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
                  On-chain actions
                </div>
                <div className="mt-1 text-lg font-black text-gray-900 flex items-center gap-2">
                  Claim / Refund <Wallet size={16} />
                </div>
                <div className="mt-1 text-xs font-bold text-gray-700/80">
                  These buttons call the raffle contract directly.
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <a
                  href={addrUrl(raffleId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl bg-white/70 hover:bg-white border border-white/60 px-3 py-2 text-xs font-black text-blue-700"
                >
                  Contract <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(raffleId)}
                  className="p-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700"
                  title="Copy raffle address"
                  aria-label="Copy raffle address"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Balances */}
          <div className="grid gap-2">
            <StatRow
              icon={<Coins size={16} />}
              label="Claimable USDC"
              value={`${display.usdc} USDC`}
              loading={qClaimableUSDC.isLoading}
            />
            <StatRow
              icon={<ArrowDownCircle size={16} />}
              label="Claimable XTZ"
              value={`${display.xtz} XTZ`}
              loading={qClaimableXTZ.isLoading}
            />
            <StatRow
              icon={<TicketIcon />}
              label="Tickets owned"
              value={display.tickets}
              loading={qTicketsOwned.isLoading}
            />
          </div>

          {/* Actions */}
          <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
            <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
              Actions
            </div>

            <div className="mt-3 grid gap-2">
              <ActionButton
                disabled={!canWithdrawUSDC}
                onClick={runWithdrawUSDC}
                icon={<Coins size={16} />}
                label={busy && action === "withdrawUSDC" ? "Withdrawing USDC…" : "Withdraw USDC"}
                sub={
                  claimableUSDC > 0n
                    ? `Available: ${display.usdc} USDC`
                    : "No USDC available"
                }
              />

              <ActionButton
                disabled={!canWithdrawXTZ}
                onClick={runWithdrawXTZ}
                icon={<ArrowDownCircle size={16} />}
                label={busy && action === "withdrawXTZ" ? "Withdrawing XTZ…" : "Withdraw XTZ"}
                sub={claimableXTZ > 0n ? `Available: ${display.xtz} XTZ` : "No XTZ available"}
              />

              <ActionButton
                disabled={!canRefund}
                onClick={runRefund}
                icon={<RefundIcon />}
                label={busy && action === "refund" ? "Claiming refund…" : "Claim ticket refund"}
                sub={ticketsOwned > 0n ? `Tickets: ${display.tickets}` : "No tickets owned"}
                tone="warn"
              />
            </div>

            <div className="mt-3 text-[11px] font-bold text-gray-700/80">
              If an action fails, it usually means nothing is claimable/refundable right now (or the raffle isn’t in the right state).
            </div>
          </div>

          {/* TX feedback */}
          {txHash ? (
            <div className="rounded-3xl bg-white/70 border border-white/60 p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-black text-gray-700 uppercase tracking-wider">
                  Transaction
                </div>
                <div className="mt-1 text-sm font-black text-gray-900 flex items-center gap-2">
                  {tx.isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Pending…
                    </>
                  ) : tx.isSuccess ? (
                    <>
                      <CheckCircle2 size={16} className="text-green-700" /> Confirmed
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="text-amber-700" /> Sent
                    </>
                  )}
                </div>
                <div className="mt-1 text-xs font-bold text-gray-700/80 truncate">
                  {shortAddr(txHash)}
                </div>
              </div>

              <a
                href={txUrl(String(txHash))}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-black text-blue-700"
              >
                View <ExternalLink size={12} />
              </a>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function StatRow({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
      <div className="min-w-0 flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-800">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
            {label}
          </div>
          <div className="mt-0.5 font-black text-gray-900 truncate">
            {loading ? "Loading…" : value}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  disabled,
  onClick,
  icon,
  label,
  sub,
  tone = "normal",
}: {
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
  tone?: "normal" | "warn";
}) {
  const base =
    "w-full text-left rounded-2xl px-4 py-3 border shadow-sm transition-all flex items-center justify-between gap-3";
  const left =
    "flex items-center gap-3 min-w-0";
  const right =
    "shrink-0";

  const skin = disabled
    ? "bg-white/40 border-white/60 text-gray-500 cursor-not-allowed"
    : tone === "warn"
      ? "bg-amber-500/90 hover:bg-amber-500 border-amber-300 text-white"
      : "bg-gray-900 hover:bg-gray-800 border-gray-700 text-white";

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${skin}`}>
      <div className={left}>
        <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-black truncate">{label}</div>
          <div className="text-[11px] font-bold opacity-90 truncate">{sub}</div>
        </div>
      </div>
      <div className={right}>
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/15">
          <ExternalLink size={14} />
        </span>
      </div>
    </button>
  );
}

function TicketIcon() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 font-black">
      🎟️
    </span>
  );
}

function RefundIcon() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 font-black">
      ↩️
    </span>
  );
}