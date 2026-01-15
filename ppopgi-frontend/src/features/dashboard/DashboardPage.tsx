// src/features/dashboard/DashboardPage.tsx
import { useMemo } from "react";
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
} from "lucide-react";
import { useDashboard } from "./useDashboard";
import { friendlyStatus } from "../../lib/format";
import { addrUrl } from "../../lib/explorer";

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
  const s = friendlyStatus(status);
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

  const hasAnything = created.length > 0 || activityByRaffle.length > 0;

  const headerName = useMemo(() => {
    if (!me) return "Player Dashboard";
    return "Player Dashboard";
  }, [me]);

  const sub = useMemo(() => {
    if (!me) return "Your On-Chain History";
    return `Your On-Chain History • ${shortAddr(me)}`;
  }, [me]);

  return (
    <div className="min-h-screen pt-24 pb-24 px-4 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* HERO */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg border-2 border-white">
              <Wallet className="text-white" size={22} />
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-black text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)] uppercase tracking-tight">
                {headerName}
              </div>
              <div className="text-white/80 font-bold text-sm md:text-base">
                {sub}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreate}
              className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <PlusCircle size={18} /> Create
            </button>
            <button
              onClick={onClose}
              className="bg-white/85 hover:bg-white text-gray-800 font-black px-4 py-2.5 rounded-xl shadow-lg transition-all border border-white/60"
            >
              Close
            </button>
          </div>
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
                  <div className="text-lg font-black text-gray-900">
                    Your activity across raffles
                  </div>
                </div>
              </div>

              {me ? (
                <a
                  href={addrUrl(me)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-black text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                  title="View address on explorer"
                >
                  {shortAddr(me)} <ExternalLink size={12} />
                </a>
              ) : null}
            </div>

            <div className="p-6">
              {!hasAnything ? (
                <EmptyState />
              ) : (
                <div className="space-y-3">
                  {/* show activity first */}
                  {activityByRaffle.slice(0, 8).map(({ raffle }) => (
                    <RowCard
                      key={raffle.id}
                      title={raffle.name}
                      subtitle={`Ticket: ${raffle.ticketPrice} USDC • Pot: ${raffle.winningPot} USDC`}
                      rightTop={friendlyStatus(raffle.status) + (raffle.paused ? " (paused)" : "")}
                      rightBottom={`Ends: ${endsIn(raffle.deadline)} • Sold: ${raffle.sold}`}
                      pillClass={statusPill(raffle.status, raffle.paused)}
                      pillText={raffle.paused ? "Paused" : friendlyStatus(raffle.status)}
                      onClick={() => onOpenRaffle(raffle.id.toLowerCase())}
                    />
                  ))}

                  {/* if no activity but created exists */}
                  {activityByRaffle.length === 0 &&
                    created.slice(0, 8).map((r) => (
                      <RowCard
                        key={r.id}
                        title={r.name}
                        subtitle={`Ticket: ${r.ticketPrice} USDC • Pot: ${r.winningPot} USDC`}
                        rightTop={friendlyStatus(r.status) + (r.paused ? " (paused)" : "")}
                        rightBottom={`Ends: ${endsIn(r.deadline)} • Sold: ${r.sold}`}
                        pillClass={statusPill(r.status, r.paused)}
                        pillText={r.paused ? "Paused" : friendlyStatus(r.status)}
                        onClick={() => onOpenRaffle(r.id.toLowerCase())}
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
                <div className="text-xs font-black text-gray-500 uppercase tracking-wider">
                  Your Raffles
                </div>
                <div className="text-lg font-black text-gray-900">
                  Created by you
                </div>
              </div>
            </div>

            <div className="p-4">
              {createdQ.isLoading ? (
                <div className="p-4 text-gray-600 font-bold">Loading…</div>
              ) : created.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/60 border border-white/60 text-gray-700">
                  <div className="font-black">No raffles yet</div>
                  <div className="text-sm font-bold text-gray-600 mt-1">
                    Create one to see it here.
                  </div>
                  <button
                    onClick={onOpenCreate}
                    className="mt-4 w-full bg-gray-900 hover:bg-gray-800 text-white font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-2"
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

        {/* FOOT NOTE */}
        <div className="mt-6 text-white/70 text-xs font-bold text-center">
          This dashboard reads from your subgraph indexer. Actions (refund/claim) will be added next.
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-white/60 border border-white/60 p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mx-auto shadow-md border border-gray-100">
        <Ticket className="text-gray-600" size={22} />
      </div>

      <div className="mt-4 font-black text-gray-800 text-lg">No History Found</div>
      <div className="mt-1 text-sm font-bold text-gray-600">
        Raffles you Create or Play will appear here.
      </div>

      <div className="mt-6 inline-flex items-center gap-2 text-xs font-black text-gray-500">
        <Clock size={14} /> Recent interactions appear automatically
      </div>
    </div>
  );
}

function RowCard({
  title,
  subtitle,
  rightTop,
  rightBottom,
  pillClass,
  pillText,
  onClick,
}: {
  title: string;
  subtitle: string;
  rightTop: string;
  rightBottom: string;
  pillClass: string;
  pillText: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-white/70 hover:bg-white/85 border border-white/70 shadow-sm transition-all px-4 py-4 flex items-center justify-between gap-4"
    >
      <div className="min-w-0">
        <div className="font-black text-gray-900 truncate">{title}</div>
        <div className="text-xs font-bold text-gray-600 mt-1 truncate">
          {subtitle}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={pillClass}>{pillText}</span>
          <span className="text-xs font-black text-gray-500 inline-flex items-center gap-1">
            <Clock size={14} /> {rightBottom}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right flex items-center gap-3">
        <div className="hidden md:block">
          <div className="text-sm font-black text-gray-900">{rightTop}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow-md">
          <ArrowRight size={18} />
        </div>
      </div>
    </button>
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