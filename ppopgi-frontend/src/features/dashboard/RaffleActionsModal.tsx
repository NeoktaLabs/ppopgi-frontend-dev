// src/features/dashboard/RaffleActionsModal.tsx
import { useMemo } from "react";
import { CheckCircle2, ExternalLink, Loader2, Shield, Ticket, Wallet } from "lucide-react";
import { isAddress } from "viem";

import { Modal } from "../../ui/Modal";
import { txUrl, addrUrl } from "../../lib/explorer";
import { useRaffleActions } from "./useRaffleActions";

function shortAddr(a?: string | null) {
  if (!a) return "—";
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function RaffleActionsModal({
  open,
  onClose,
  raffleId,
  raffleName,
}: {
  open: boolean;
  onClose: () => void;
  raffleId: string | null;
  raffleName?: string | null;
}) {
  const act = useRaffleActions(open ? raffleId : null);

  const title = useMemo(() => {
    if (!raffleName) return "Manage Raffle";
    return `Manage • ${raffleName}`;
  }, [raffleName]);

  const contractLink = raffleId && isAddress(raffleId) ? addrUrl(raffleId) : undefined;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="grid gap-4">
        <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
                Live on-chain actions
              </div>
              <div className="mt-1 text-lg font-black text-gray-900 flex items-center gap-2">
                Claims & Refunds <Shield size={16} />
              </div>

              <div className="mt-2 text-xs font-bold text-gray-700/80">
                Raffle:{" "}
                {contractLink ? (
                  <a
                    href={contractLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-black text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    {shortAddr(raffleId)} <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="font-black">{shortAddr(raffleId)}</span>
                )}
              </div>
            </div>

            {act.busy ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-700 border border-gray-200">
                <Loader2 className="animate-spin" size={14} /> Pending…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-white/80 text-gray-800 border border-white/60">
                {act.enabled ? "Connected" : "Not connected"}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-2xl bg-white/70 border border-white/60 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                Tickets owned
              </div>
              <div className="mt-1 font-black text-gray-900 flex items-center gap-2">
                <Ticket size={16} /> {act.ticketsOwnedQ.isLoading ? "…" : act.fmt.ticketsOwned}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/70 border border-white/60 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                Claimable USDC
              </div>
              <div className="mt-1 font-black text-gray-900 flex items-center gap-2">
                <Wallet size={16} /> {act.claimableFundsQ.isLoading ? "…" : `${act.fmt.claimableUSDC} USDC`}
              </div>
            </div>
            <button
              type="button"
              disabled={!act.canClaimUSDC}
              onClick={act.claimUSDC}
              className={[
                "shrink-0 px-4 py-2 rounded-xl font-black text-sm border shadow-sm transition-all",
                act.canClaimUSDC
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-200"
                  : "bg-white/50 text-gray-500 border-white/60 cursor-not-allowed",
              ].join(" ")}
            >
              Claim
            </button>
          </div>

          <div className="rounded-2xl bg-white/70 border border-white/60 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                Claimable XTZ
              </div>
              <div className="mt-1 font-black text-gray-900 flex items-center gap-2">
                <Wallet size={16} />{" "}
                {act.claimableNativeQ.isLoading ? "…" : `${act.fmt.claimableXTZ} XTZ`}
              </div>
            </div>
            <button
              type="button"
              disabled={!act.canClaimXTZ}
              onClick={act.claimXTZ}
              className={[
                "shrink-0 px-4 py-2 rounded-xl font-black text-sm border shadow-sm transition-all",
                act.canClaimXTZ
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-200"
                  : "bg-white/50 text-gray-500 border-white/60 cursor-not-allowed",
              ].join(" ")}
            >
              Collect
            </button>
          </div>

          <div className="rounded-2xl bg-white/70 border border-white/60 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                Ticket refund
              </div>
              <div className="mt-1 text-xs font-bold text-gray-700">
                If this raffle is canceled and you joined, you can refund here.
              </div>
            </div>
            <button
              type="button"
              disabled={!act.canRefund}
              onClick={act.refundTickets}
              className={[
                "shrink-0 px-4 py-2 rounded-xl font-black text-sm border shadow-sm transition-all",
                act.canRefund
                  ? "bg-gray-900 hover:bg-gray-800 text-white border-gray-700"
                  : "bg-white/50 text-gray-500 border-white/60 cursor-not-allowed",
              ].join(" ")}
            >
              Refund
            </button>
          </div>
        </div>

        {act.txHash ? (
          <div className="rounded-3xl bg-white/70 border border-white/60 p-4 flex items-center justify-between gap-3">
            <div className="text-xs font-bold text-gray-700">
              {act.tx.isLoading
                ? "Transaction pending…"
                : act.tx.isSuccess
                  ? "Transaction confirmed"
                  : "Transaction sent"}
            </div>
            <a
              href={txUrl(String(act.txHash))}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-black text-blue-700 hover:underline inline-flex items-center gap-1"
            >
              View <ExternalLink size={12} />
            </a>
          </div>
        ) : null}

        {act.tx.isSuccess ? (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-3 text-sm font-black text-green-900 inline-flex items-center gap-2">
            <CheckCircle2 size={16} /> Done
          </div>
        ) : null}
      </div>
    </Modal>
  );
}