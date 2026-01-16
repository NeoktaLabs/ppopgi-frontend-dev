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
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
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
    <Modal
      open={isOpen}
      onClose={onClose}
      variant="solid"
      width="2xl"
      height="auto"
      bodyClassName="p-0"
      header={
        <div className="bg-[#FFD700] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/90 border border-amber-200 flex items-center justify-center shadow-sm">
                <Store size={22} className="text-amber-700" />
              </div>
              <div>
                <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                  Balances + quick actions
                </div>
                <div className="mt-1 text-2xl font-black text-amber-950 leading-tight">
                  Coin Cashier 🏪
                </div>
                <div className="mt-1 text-[12px] font-bold text-amber-950/70">
                  See your balances and jump to the right place.
                </div>
              </div>
            </div>

            <div className="hidden sm:block text-right">
              <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                Wallet
              </div>
              <div className="mt-1 font-black text-amber-950">{shortAddr(address)}</div>
            </div>
          </div>
        </div>
      }
    >
      <div className="p-6 grid gap-5">
        {/* Safety note */}
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/70">
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-[11px] font-black text-gray-700">
              <Sparkles size={14} className="text-amber-600" />
              Safety note
            </div>
            <div className="mt-2 text-sm font-black text-gray-900">How Energy (XTZ) works</div>
            <div className="mt-1 text-[12px] font-bold text-gray-600">
              Some actions can temporarily lock Energy. If it can’t be returned instantly, it’s{" "}
              <span className="font-black text-gray-900">always saved</span> and can be collected later from your{" "}
              <span className="font-black text-gray-900">Dashboard</span>.
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* USDC */}
          <Card
            title="Entry Coins (USDC)"
            badge="Used for tickets"
            icon={<Coins size={18} />}
          >
            <div className="grid gap-3">
              <StatRow label="Your balance" value={`${usdc} USDC`} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onGoExplore?.();
                  }}
                  className="rounded-2xl bg-[#FFD700] hover:bg-amber-300 text-amber-950 border border-amber-200 px-4 py-3 text-sm font-black transition active:translate-y-[1px] inline-flex items-center justify-center gap-2"
                  type="button"
                >
                  Browse raffles <ArrowRight size={16} />
                </button>

                <button
                  disabled
                  className="rounded-2xl bg-gray-100 border border-gray-200 text-gray-400 px-4 py-3 text-sm font-black cursor-not-allowed"
                  title="Coming soon"
                  type="button"
                >
                  Get USDC
                </button>
              </div>

              {!isConnected && (
                <div className="text-[11px] font-bold text-gray-500">
                  Connect your wallet to see live balances.
                </div>
              )}
            </div>
          </Card>

          {/* XTZ */}
          <Card
            title="Energy Coins (XTZ)"
            badge="Gas & draws"
            icon={<Zap size={18} />}
          >
            <div className="grid gap-3">
              <StatRow label="Your balance" value={`${xtz} XTZ`} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onGoDashboard?.();
                  }}
                  disabled={disabled || !onGoDashboard}
                  className={[
                    "rounded-2xl px-4 py-3 text-sm font-black transition active:translate-y-[1px] inline-flex items-center justify-center gap-2",
                    disabled || !onGoDashboard
                      ? "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white hover:bg-gray-50 text-gray-900 border border-gray-200",
                  ].join(" ")}
                  title={!onGoDashboard ? "Dashboard hook not wired yet" : undefined}
                  type="button"
                >
                  Collect Energy <ExternalLink size={16} />
                </button>

                <button
                  disabled
                  className="rounded-2xl bg-gray-100 border border-gray-200 text-gray-400 px-4 py-3 text-sm font-black cursor-not-allowed"
                  title="Coming soon"
                  type="button"
                >
                  Add Energy
                </button>
              </div>

              <div className="text-[11px] font-bold text-gray-500">
                Tip: Energy is needed for the draw step and some actions.
              </div>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 font-black transition"
          type="button"
        >
          Back to Park
        </button>
      </div>
    </Modal>
  );
}

function Card({
  title,
  badge,
  icon,
  children,
}: {
  title: string;
  badge: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/70">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-700">
              {icon}
            </div>
            <div className="font-black text-gray-900 text-sm">{title}</div>
          </div>

          <span className="text-[11px] font-black bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-full">
            {badge}
          </span>
        </div>
      </div>

      <div className="p-5">{children}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold text-gray-500">{label}</span>
      <span className="text-sm font-black text-gray-900">{value}</span>
    </div>
  );
}