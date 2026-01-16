// src/features/cashier/CashierModal.tsx
import { Coins, Store, Zap, ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { formatUnits } from "viem";

import { Modal } from "../../ui/Modal";
import { ADDR, ERC20_ABI } from "../../lib/contracts";

function fmt(n?: string) {
  if (!n) return "0";
  const [a, b] = n.split(".");
  if (!b) return a;
  return `${a}.${b.slice(0, 4)}`;
}

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function CashierModal({
  isOpen,
  onClose,
  onGoDashboard,
  onGoExplore,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: open your dashboard overlay */
  onGoDashboard?: () => void;
  /** Optional: jump to explore (or home) */
  onGoExplore?: () => void;
}) {
  const { address, isConnected } = useAccount();

  const xtzBal = useBalance({
    address,
    query: { enabled: !!address },
  });

  const usdcDecimals = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: true },
  });

  const usdcBal = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const d = Number(usdcDecimals.data ?? 6);

  const xtz = xtzBal.data ? fmt(xtzBal.data.formatted) : isConnected ? "…" : "0";
  const usdc = usdcBal.data ? fmt(formatUnits(usdcBal.data as bigint, d)) : isConnected ? "…" : "0";

  const disabled = !isConnected;

  return (
    <Modal open={isOpen} onClose={onClose} title="Coin Cashier" width="2xl" height="auto">
      <div className="grid gap-4">
        {/* Cashier-like header strip (matches CreateRaffle style) */}
        <div className="rounded-3xl overflow-hidden border border-white/20">
          <div className="bg-[#FFD700] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md">
                  <Store size={22} className="text-amber-600" />
                </div>
                <div>
                  <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                    Balances + quick actions
                  </div>
                  <div className="mt-1 text-xl font-black text-amber-900 leading-tight">
                    Coin Cashier 🏪
                  </div>
                  <div className="mt-1 text-[12px] font-bold text-amber-900/80">
                    See your balances and jump to the right place.
                  </div>
                </div>
              </div>

              <div className="hidden sm:block text-right">
                <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                  Wallet
                </div>
                <div className="mt-1 text-sm font-black text-amber-900">
                  {address ? shortAddr(address) : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5">
            {/* Safety note */}
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-black text-white/80">
                <Sparkles size={14} className="text-white/80" />
                Safety note
              </div>

              <div className="mt-3 text-sm font-black text-white">How Energy (XTZ) works</div>
              <p className="mt-1 text-sm font-bold text-white/70 leading-relaxed">
                Energy powers the park. Some actions can temporarily lock Energy. If it can’t be returned instantly,
                it’s <span className="font-black text-white">always saved</span> and can be collected later from your{" "}
                <span className="font-black text-white">Dashboard</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* USDC */}
          <div className="rounded-3xl border border-white/15 bg-white/10 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="bg-white/10 border border-white/15 p-2.5 rounded-2xl text-white shadow-sm">
                  <Coins size={22} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-white text-sm">Entry Coins (USDC)</div>
                    <span className="text-[11px] font-black bg-white/10 border border-white/15 text-white/80 px-2 py-1 rounded-full">
                      Used for tickets
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                    <span className="text-[11px] font-bold text-white/60">Your balance</span>
                    <span className="text-sm font-black text-white">{usdc} USDC</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        onGoExplore?.();
                      }}
                      className="flex-1 rounded-2xl bg-white text-gray-900 hover:bg-gray-100 px-4 py-3 text-sm font-black transition active:translate-y-[1px]"
                      type="button"
                    >
                      Browse raffles <ArrowRight className="inline-block ml-2" size={16} />
                    </button>

                    <button
                      disabled
                      className="rounded-2xl bg-white/10 border border-white/15 text-white/50 px-4 py-3 text-sm font-black cursor-not-allowed"
                      title="Coming soon"
                      type="button"
                    >
                      Get USDC
                    </button>
                  </div>

                  {!isConnected && (
                    <div className="mt-2 text-[11px] font-bold text-white/60">
                      Connect your wallet to see live balances.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* XTZ */}
          <div className="rounded-3xl border border-white/15 bg-white/10 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="bg-white/10 border border-white/15 p-2.5 rounded-2xl text-white shadow-sm">
                  <Zap size={22} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-white text-sm">Energy Coins (XTZ)</div>
                    <span className="text-[11px] font-black bg-white/10 border border-white/15 text-white/80 px-2 py-1 rounded-full">
                      Gas & draws
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                    <span className="text-[11px] font-bold text-white/60">Your balance</span>
                    <span className="text-sm font-black text-white">{xtz} XTZ</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        onGoDashboard?.();
                      }}
                      disabled={disabled || !onGoDashboard}
                      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition active:translate-y-[1px] inline-flex items-center justify-center gap-2 ${
                        disabled || !onGoDashboard
                          ? "bg-white/10 border border-white/15 text-white/50 cursor-not-allowed"
                          : "bg-white text-gray-900 hover:bg-gray-100"
                      }`}
                      title={!onGoDashboard ? "Dashboard hook not wired yet" : undefined}
                      type="button"
                    >
                      Collect Energy <ExternalLink size={16} />
                    </button>

                    <button
                      disabled
                      className="rounded-2xl bg-white/10 border border-white/15 text-white/50 px-4 py-3 text-sm font-black cursor-not-allowed"
                      title="Coming soon"
                      type="button"
                    >
                      Add Energy
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] font-bold text-white/60">
                    Tip: Energy is needed for the draw step and some actions.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4 py-3 font-black transition"
          type="button"
        >
          Back to Park
        </button>
      </div>
    </Modal>
  );
}