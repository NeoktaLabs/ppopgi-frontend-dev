// src/features/cashier/CashierModal.tsx
import { Coins, Store, X, Zap, ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { ADDR, ERC20_ABI } from "../../lib/contracts";
import { formatUnits } from "viem";

function fmt(n?: string) {
  if (!n) return "0";
  const [a, b] = n.split(".");
  if (!b) return a;
  return `${a}.${b.slice(0, 4)}`;
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

  if (!isOpen) return null;

  const disabled = !isConnected;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ✅ Wider + centered + not full height */}
      <div className="relative w-full max-w-4xl max-h-[82vh] overflow-hidden bg-white rounded-3xl shadow-2xl border border-gray-200 animate-fade-in-up">
        {/* Header stays fixed; body scrolls */}
        <div className="bg-[#FFD700] p-5 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-amber-900 hover:text-white transition-colors"
            aria-label="Close"
            type="button"
          >
            <X size={22} />
          </button>

          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-md">
            <Store size={32} className="text-amber-500" />
          </div>

          <h2 className="text-xl font-black text-amber-900 uppercase tracking-tight">
            Coin Cashier 🏪
          </h2>
          <p className="text-[12px] font-bold text-amber-900/80 mt-1">
            See your balances + quick actions
          </p>
        </div>

        {/* ✅ Body scroll area */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(82vh-116px)]">
          {/* Info box */}
          <div className="text-center text-sm text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="bg-white border border-gray-200 rounded-full px-3 py-1 text-[11px] font-black text-gray-700 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                Safety note
              </div>
            </div>

            <p className="font-bold text-gray-900 mb-1">How Energy (XTZ) works:</p>
            <p className="text-gray-600 leading-relaxed">
              Energy powers the park. Some actions can temporarily lock Energy. If it can’t be returned instantly, it’s{" "}
              <span className="font-black text-amber-700">always saved</span> and can be collected later from your{" "}
              <span className="font-black text-gray-800">Dashboard</span>.
            </p>
          </div>

          {/* ✅ On large screens, show 2 columns; on mobile keep stacked */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* USDC */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50 overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700 shadow-sm">
                  <Coins size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black text-amber-900 text-sm">Entry Coins (USDC)</h4>
                    <span className="text-[11px] font-black bg-white/70 border border-amber-200 text-amber-800 px-2 py-1 rounded-full">
                      Used for tickets
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between bg-white/70 border border-amber-200 rounded-xl px-3 py-2">
                    <span className="text-[11px] font-bold text-amber-900/80">Your balance</span>
                    <span className="text-[12px] font-black text-amber-900">{usdc} USDC</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        onGoExplore?.();
                      }}
                      className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-xl py-2.5 text-sm font-black shadow-md active:translate-y-[1px] transition"
                      type="button"
                    >
                      Browse raffles
                      <ArrowRight className="inline-block ml-2" size={16} />
                    </button>

                    <button
                      disabled
                      className="px-3 bg-white/80 border border-amber-200 text-amber-900/60 rounded-xl py-2.5 text-sm font-black cursor-not-allowed"
                      title="Coming soon"
                      type="button"
                    >
                      Get USDC
                    </button>
                  </div>

                  {!isConnected && (
                    <div className="mt-2 text-[11px] font-bold text-amber-900/70">
                      Connect your wallet to see live balances.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* XTZ */}
            <div className="rounded-2xl border border-green-100 bg-green-50 overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="bg-green-100 p-2.5 rounded-xl text-green-700 shadow-sm">
                  <Zap size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black text-green-900 text-sm">Energy Coins (XTZ)</h4>
                    <span className="text-[11px] font-black bg-white/70 border border-green-200 text-green-800 px-2 py-1 rounded-full">
                      Gas & draws
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between bg-white/70 border border-green-200 rounded-xl px-3 py-2">
                    <span className="text-[11px] font-bold text-green-900/80">Your balance</span>
                    <span className="text-[12px] font-black text-green-900">{xtz} XTZ</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        onGoDashboard?.();
                      }}
                      disabled={disabled || !onGoDashboard}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-black shadow-md active:translate-y-[1px] transition flex items-center justify-center gap-2 ${
                        disabled || !onGoDashboard
                          ? "bg-white/70 border border-green-200 text-green-900/50 cursor-not-allowed shadow-none"
                          : "bg-green-700 hover:bg-green-800 text-white"
                      }`}
                      title={!onGoDashboard ? "Dashboard hook not wired yet" : undefined}
                      type="button"
                    >
                      Collect Energy
                      <ExternalLink size={16} />
                    </button>

                    <button
                      disabled
                      className="px-3 bg-white/80 border border-green-200 text-green-900/60 rounded-xl py-2.5 text-sm font-black cursor-not-allowed"
                      title="Coming soon"
                      type="button"
                    >
                      Add Energy
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] font-bold text-green-900/70">
                    Tip: Energy is needed for the draw step and some actions.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-1">
            <button
              onClick={onClose}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl py-3 font-black transition"
              type="button"
            >
              Back to Park
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}