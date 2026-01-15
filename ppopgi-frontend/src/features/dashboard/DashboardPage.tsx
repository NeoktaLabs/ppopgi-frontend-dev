import { useMemo } from "react";
import { Ticket, Trophy, Clock, PlusCircle } from "lucide-react";
import { useDashboard } from "./useDashboard";
import { friendlyStatus } from "../../lib/format";

function shortAddr(a?: string) {
  if (!a) return "";
  const s = a.toString();
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function toDateLabel(deadline?: string) {
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

  const title = useMemo(() => {
    if (!me) return "Dashboard";
    return `Player ${shortAddr(me)}`;
  }, [me]);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-800 uppercase">{title}</h1>
            <p className="text-gray-600 font-bold text-sm mt-1">
              Your park activity (from the indexer).
            </p>
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
              className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-100 px-4 py-2.5 rounded-xl font-black shadow-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {!hasAnything && (
          <div className="bg-white/80 backdrop-blur-md rounded-3xl p-10 border border-white/60 shadow-xl text-center">
            <div className="text-gray-800 font-black text-2xl">No activity yet</div>
            <div className="text-gray-600 font-bold text-sm mt-2">
              Create a raffle or buy a ticket to see history here.
            </div>
          </div>
        )}

        {/* Created */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-md rotate-[-4deg]">
              <Trophy size={18} />
            </div>
            <h2 className="text-xl font-black text-gray-800 uppercase">Your Raffles</h2>
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {createdQ.isLoading && (
                <div className="p-6 text-gray-600 font-bold">Loading…</div>
              )}

              {!createdQ.isLoading && created.length === 0 && (
                <div className="p-6 text-gray-500 font-bold">None created yet.</div>
              )}

              {created.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onOpenRaffle(r.id.toLowerCase())}
                  className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-black text-gray-800 truncate">{r.name}</div>
                      <div className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Ticket size={14} /> {r.ticketPrice} USDC
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Trophy size={14} /> {r.winningPot} USDC
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={14} /> {toDateLabel(r.deadline)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black text-gray-800">
                        {friendlyStatus(r.status)}
                        {r.paused ? " (paused)" : ""}
                      </div>
                      <div className="text-xs font-bold text-gray-500 mt-1">
                        Sold: {r.sold}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Activity */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md rotate-[-4deg]">
              <Ticket size={18} />
            </div>
            <h2 className="text-xl font-black text-gray-800 uppercase">Your Activity</h2>
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {activityByRaffle.length === 0 && (
                <div className="p-6 text-gray-500 font-bold">No activity yet.</div>
              )}

              {activityByRaffle.map(({ raffle }) => (
                <button
                  key={raffle.id}
                  onClick={() => onOpenRaffle(raffle.id.toLowerCase())}
                  className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-black text-gray-800 truncate">{raffle.name}</div>
                      <div className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Ticket size={14} /> {raffle.ticketPrice} USDC
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Trophy size={14} /> {raffle.winningPot} USDC
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={14} /> {toDateLabel(raffle.deadline)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black text-gray-800">
                        {friendlyStatus(raffle.status)}
                        {raffle.paused ? " (paused)" : ""}
                      </div>
                      <div className="text-xs font-bold text-gray-500 mt-1">
                        Sold: {raffle.sold}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}