// src/features/dashboard/DashboardPage.tsx
import { useMemo, useState } from "react";
import {
  Ticket,
  Trophy,
  Clock,
  PlusCircle,
  Activity,
  Wallet,
  Sparkles,
  ExternalLink,
  ArrowRight,
  Copy,
  Coins,
  Zap,
  RotateCcw,
} from "lucide-react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useDashboard } from "./useDashboard";
import { friendlyStatus } from "../../lib/format";
import { addrUrl, txUrl } from "../../lib/explorer";
import { ADDR, LOTTERY_SINGLE_WINNER_ABI } from "../../lib/contracts";
import { formatUnits } from "viem";

function shortAddr(a?: string) {
  if (!a) return "";
  const s = a.toString();
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function endsIn(deadline?: string) {
  const d = Number(deadline || 0);
  if (!d) return "—";
  const diff = d * 1000 - Date.now();
  if (diff <= 0) return "Ended";
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

function statusPill(status?: string, paused?: boolean) {
  const base =
    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black border shadow-sm";
  if (paused) return `${base} bg-gray-100 text-gray-700 border-gray-200`;
  switch ((status || "").toUpperCase()) {
    case "OPEN":
      return `${base} bg-green-100 text-green-800 border-green-200`;
    case "DRAWING":
      return `${base} bg-blue-100 text-blue-800 border-blue-200`;
    case "COMPLETED":
      return `${base} bg-purple-100 text-purple-800 border-purple-200`;
    case "CANCELED":
    case "CANCELLED":
      return `${base} bg-red-100 text-red-800 border-red-200`;
    default:
      return `${base} bg-amber-100 text-amber-800 border-amber-200`;
  }
}

function glassCard() {
  return "bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_20px_70px_rgba(0,0,0,0.18)]";
}

function fmtUSDC(raw?: bigint | null) {
  if (!raw) return "0";
  return Number(formatUnits(raw, 6)).toFixed(2);
}

function fmtXTZ(raw?: bigint | null) {
  if (!raw) return "0";
  return Number(formatUnits(raw, 18)).toFixed(4);
}

export function DashboardPage({
  onClose,
  onOpenRaffle,
  onOpenCreate,
}: {
  onClose: () => void;
  onOpenRaffle: (id: string) => void;
  onOpenCreate: () => void;
}) {
  const { me, createdQ, activityByRaffle } = useDashboard();
  const created = createdQ.data?.raffles ?? [];

  const headerName = useMemo(() => "Player Dashboard", []);
  const sub = useMemo(() => {
    if (!me) return "Your On-Chain History";
    return `Your On-Chain History • ${shortAddr(me)}`;
  }, [me]);

  const hasAnything = created.length > 0 || activityByRaffle.length > 0;

  return (
    <div className="min-h-screen pt-24 pb-24 px-4 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* HERO */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg border-2 border-white">
                <Wallet className="text-white" size={22} />
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-black text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)] uppercase tracking-tight">
                  {headerName}
                </div>
                <div className="text-white/80 font-bold text-sm md:text-base">{sub}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenCreate}
                className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
                type="button"
              >
                <PlusCircle size={18} /> Create
              </button>
              <button
                onClick={onClose}
                className="bg-white/85 hover:bg-white text-gray-800 font-black px-4 py-2.5 rounded-xl shadow-lg transition-all border border-white/60"
                type="button"
              >
                Close
              </button>
            </div>
          </div>

          {/* Address chip */}
          {me ? (
            <div className="mt-4">
              <div className="inline-flex items-center gap-2 bg-white/85 border border-white/60 rounded-2xl px-3 py-2 shadow-lg">
                <span className="text-xs font-black text-gray-700">Connected:</span>
                <a
                  href={addrUrl(me)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-black text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                  title="View on explorer"
                >
                  {shortAddr(me)} <ExternalLink size={12} />
                </a>
                <button
                  onClick={() => navigator.clipboard?.writeText(me)}
                  className="ml-1 p-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700"
                  title="Copy address"
                  aria-label="Copy address"
                  type="button"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Recent interactions */}
          <div className={`lg:col-span-2 rounded-3xl overflow-hidden ${glassCard()}`}>
            <div className="px-6 py-5 flex items-center justify-between border-b border-white/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-900 text-white shadow-md rotate-[-4deg]">
                  <Activity size={18} />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-500 uppercase tracking-wider">
                    Recent Interactions
                  </div>
                  <div className="text-lg font-black text-gray-900">Your activity across raffles</div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {!hasAnything ? (
                <EmptyState onOpenCreate={onOpenCreate} />
              ) : (
                <div className="space-y-3">
                  {activityByRaffle.slice(0, 8).map(({ raffle }) => (
                    <RaffleRowWithActions
                      key={raffle.id}
                      me={me ?? ""}
                      raffle={raffle}
                      pillClass={statusPill(raffle.status, raffle.paused)}
                      pillText={raffle.paused ? "Paused" : friendlyStatus(raffle.status)}
                      subtitle={`Ticket: ${raffle.ticketPrice} USDC • Pot: ${raffle.winningPot} USDC`}
                      rightBottom={`Ends: ${endsIn(raffle.deadline)} • Sold: ${raffle.sold}`}
                      onOpen={() => onOpenRaffle(raffle.id.toLowerCase())}
                    />
                  ))}

                  {activityByRaffle.length === 0 &&
                    created.slice(0, 8).map((raffle) => (
                      <RaffleRowWithActions
                        key={raffle.id}
                        me={me ?? ""}
                        raffle={raffle}
                        pillClass={statusPill(raffle.status, raffle.paused)}
                        pillText={raffle.paused ? "Paused" : friendlyStatus(raffle.status)}
                        subtitle={`Ticket: ${raffle.ticketPrice} USDC • Pot: ${raffle.winningPot} USDC`}
                        rightBottom={`Ends: ${endsIn(raffle.deadline)} • Sold: ${raffle.sold}`}
                        onOpen={() => onOpenRaffle(raffle.id.toLowerCase())}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Your raffles */}
          <div className={`rounded-3xl overflow-hidden ${glassCard()}`}>
            <div className="px-6 py-5 flex items-center gap-3 border-b border-white/60">
              <div className="p-2 rounded-xl bg-amber-500 text-white shadow-md rotate-[-4deg]">
                <Trophy size={18} />
              </div>
              <div>
                <div className="text-xs font-black text-gray-500 uppercase tracking-wider">Your Raffles</div>
                <div className="text-lg font-black text-gray-900">Created by you</div>
              </div>
            </div>

            <div className="p-4">
              {createdQ.isLoading ? (
                <div className="p-4 text-gray-600 font-bold">Loading…</div>
              ) : created.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/60 border border-white/60 text-gray-700">
                  <div className="font-black">No raffles yet</div>
                  <div className="text-sm font-bold text-gray-600 mt-1">Create one to see it here.</div>
                  <button
                    onClick={onOpenCreate}
                    className="mt-4 w-full bg-gray-900 hover:bg-gray-800 text-white font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-2"
                    type="button"
                  >
                    <Sparkles size={18} /> Create a raffle
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {created.slice(0, 8).map((r) => (
                    <MiniCard
                      key={r.id}
                      title={r.name}
                      meta={`Ends: ${endsIn(r.deadline)} • Sold: ${r.sold}`}
                      pillClass={statusPill(r.status, r.paused)}
                      pillText={r.paused ? "Paused" : friendlyStatus(r.status)}
                      onClick={() => onOpenRaffle(r.id.toLowerCase())}
                    />
                  ))}

                  {created.length > 8 && (
                    <div className="text-center text-xs font-black text-gray-500 pt-1">
                      Showing 8 of {created.length}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-white/70 text-xs font-bold text-center">
          Claims & refunds are live from the raffle contracts (USDC + Energy).
        </div>
      </div>
    </div>
  );
}

function RaffleRowWithActions({
  me,
  raffle,
  subtitle,
  rightBottom,
  pillClass,
  pillText,
  onOpen,
}: {
  me: string;
  raffle: {
    id: string;
    name: string;
    status: string;
    paused: boolean;
    ticketPrice: string;
    winningPot: string;
    deadline: string;
    sold: string;
  };
  subtitle: string;
  rightBottom: string;
  pillClass: string;
  pillText: string;
  onOpen: () => void;
}) {
  const addr = raffle.id as `0x${string}`;
  const enabled = !!me && me.startsWith("0x") && me.length === 42;

  const ticketsOwnedQ = useReadContract({
    address: addr,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "ticketsOwned",
    args: enabled ? ([me as `0x${string}`] as const) : undefined,
    query: { enabled: enabled && !!addr },
  });

  const claimableFundsQ = useReadContract({
    address: addr,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableFunds",
    args: enabled ? ([me as `0x${string}`] as const) : undefined,
    query: { enabled: enabled && !!addr },
  });

  const claimableNativeQ = useReadContract({
    address: addr,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "claimableNative",
    args: enabled ? ([me as `0x${string}`] as const) : undefined,
    query: { enabled: enabled && !!addr },
  });

  const ticketsOwned = (ticketsOwnedQ.data as bigint | undefined) ?? 0n;
  const claimableUSDC = (claimableFundsQ.data as bigint | undefined) ?? 0n;
  const claimableXTZ = (claimableNativeQ.data as bigint | undefined) ?? 0n;

  const canRefund = ticketsOwned > 0n;
  const canClaimUSDC = claimableUSDC > 0n;
  const canClaimXTZ = claimableXTZ > 0n;

  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<null | "refund" | "usdc" | "xtz">(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  async function act(kind: "refund" | "usdc" | "xtz") {
    if (!enabled || !addr) return;
    setBusy(kind);
    setLastTx(null);
    try {
      if (kind === "refund") {
        const tx = await writeContractAsync({
          address: addr,
          abi: LOTTERY_SINGLE_WINNER_ABI,
          functionName: "claimTicketRefund",
        });
        setLastTx(tx);
      }
      if (kind === "usdc") {
        const tx = await writeContractAsync({
          address: addr,
          abi: LOTTERY_SINGLE_WINNER_ABI,
          functionName: "withdrawFunds",
        });
        setLastTx(tx);
      }
      if (kind === "xtz") {
        const tx = await writeContractAsync({
          address: addr,
          abi: LOTTERY_SINGLE_WINNER_ABI,
          functionName: "withdrawNative",
        });
        setLastTx(tx);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full rounded-2xl bg-white/70 border border-white/70 shadow-sm transition-all px-4 py-4">
      <button onClick={onOpen} className="w-full text-left" type="button">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-black text-gray-900 truncate">{raffle.name}</div>
            <div className="text-xs font-bold text-gray-600 mt-1 truncate">{subtitle}</div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className={pillClass}>{pillText}</span>
              <span className="text-xs font-black text-gray-500 inline-flex items-center gap-1">
                <Clock size={14} /> {rightBottom}
              </span>
            </div>
          </div>

          <div className="shrink-0 text-right flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow-md">
              <ArrowRight size={18} />
            </div>
          </div>
        </div>
      </button>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <ActionCard
          icon={<Coins size={16} />}
          title="Claim USDC"
          value={`${fmtUSDC(claimableUSDC)} USDC`}
          disabled={!canClaimUSDC || busy !== null}
          loading={busy === "usdc"}
          onClick={() => act("usdc")}
        />

        <ActionCard
          icon={<Zap size={16} />}
          title="Collect Energy"
          value={`${fmtXTZ(claimableXTZ)} XTZ`}
          disabled={!canClaimXTZ || busy !== null}
          loading={busy === "xtz"}
          onClick={() => act("xtz")}
        />

        <ActionCard
          icon={<RotateCcw size={16} />}
          title="Refund Tickets"
          value={`${ticketsOwned.toString()} tickets`}
          disabled={!canRefund || busy !== null}
          loading={busy === "refund"}
          onClick={() => act("refund")}
        />
      </div>

      {lastTx ? (
        <div className="mt-3 text-xs font-bold text-gray-700">
          Tx:{" "}
          <a
            href={txUrl(lastTx)}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:text-blue-700 hover:underline"
          >
            {lastTx.slice(0, 10)}…{lastTx.slice(-6)}
          </a>
        </div>
      ) : null}

      {/* tiny guard (wrong network etc.) */}
      {!enabled ? (
        <div className="mt-3 text-xs font-bold text-gray-600">
          Connect to enable claims.
        </div>
      ) : null}
    </div>
  );
}

function ActionCard({
  icon,
  title,
  value,
  disabled,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-4 py-3 text-left transition-all shadow-sm ${
        disabled
          ? "bg-gray-100/80 border-gray-200 text-gray-500 cursor-not-allowed"
          : "bg-white/80 hover:bg-white border-white/70 text-gray-900"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              disabled ? "bg-white border-gray-200" : "bg-gray-900 text-white border-gray-900"
            }`}
          >
            {icon}
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wide opacity-70">{title}</div>
            <div className="text-sm font-black">{value}</div>
          </div>
        </div>

        <div className="text-xs font-black">
          {loading ? "…" : disabled ? "—" : "Go"}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onOpenCreate }: { onOpenCreate: () => void }) {
  return (
    <div className="rounded-3xl bg-white/60 border border-white/60 p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mx-auto shadow-md border border-gray-100">
        <Ticket className="text-gray-600" size={22} />
      </div>

      <div className="mt-4 font-black text-gray-800 text-lg">No History Found</div>
      <div className="mt-1 text-sm font-bold text-gray-600">
        Raffles you Create or Play will appear here.
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs font-black text-gray-500">
        <Clock size={14} /> Recent interactions appear automatically
      </div>

      <button
        onClick={onOpenCreate}
        className="mt-6 inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-black px-5 py-3 rounded-xl shadow-lg"
        type="button"
      >
        <Sparkles size={18} /> Create your first raffle
      </button>
    </div>
  );
}

function MiniCard({
  title,
  meta,
  pillClass,
  pillText,
  onClick,
}: {
  title: string;
  meta: string;
  pillClass: string;
  pillText: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-white/70 hover:bg-white/85 border border-white/70 shadow-sm transition-all p-4"
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-black text-gray-900 truncate">{title}</div>
          <div className="text-xs font-bold text-gray-600 mt-1">{meta}</div>
        </div>
        <span className={pillClass}>{pillText}</span>
      </div>
    </button>
  );
}