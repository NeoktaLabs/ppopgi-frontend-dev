// src/features/explore/ExplorePage.tsx
import React, { useMemo, useState } from "react";
import { Filter, ArrowUpDown } from "lucide-react";
import {
  useExploreRaffles,
  type ExploreSortBy,
  type ExploreSortDir,
  type ExploreStatusFilter,
} from "../raffles/useRafflesExplore";

import { RaffleCard } from "../raffles/RaffleCard";
import { useNowTick } from "../../lib/useNowTick";

function computeAdaptiveStepMs(deadlinesSec: number[]) {
  const now = Date.now();
  const soonestSec = deadlinesSec.length ? Math.min(...deadlinesSec) : 0;

  if (!soonestSec || !Number.isFinite(soonestSec)) return 60_000;

  const diffMs = soonestSec * 1000 - now;

  if (diffMs <= 60_000) return 1_000; // last minute: 1s updates
  if (diffMs <= 3_600_000) return 15_000; // last hour: 15s updates
  return 60_000; // otherwise: 60s updates
}

export function ExplorePage({
  onOpenRaffle,
  onOpenSafety,
}: {
  onOpenRaffle: (id: string) => void;
  onOpenSafety?: (raffleId: string) => void;
}) {
  const [status, setStatus] = useState<ExploreStatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<ExploreSortBy>("deadline");
  const [sortDir, setSortDir] = useState<ExploreSortDir>("asc");
  const [page, setPage] = useState(0);

  const pageSize = 24;
  const skip = page * pageSize;

  const q = useExploreRaffles({ status, sortBy, sortDir, pageSize, skip });
  const raffles = q.data?.raffles ?? [];

  // ✅ Adaptive ticking (based on soonest raffle on the page)
  const deadlinesSec = useMemo(
    () =>
      raffles
        .map((r) => Number((r as any).deadline))
        .filter((n) => Number.isFinite(n) && n > 0),
    [raffles]
  );

  const stepMs = useMemo(() => computeAdaptiveStepMs(deadlinesSec), [deadlinesSec]);
  const nowMs = useNowTick(true, stepMs);

  const sortLabel = useMemo(() => {
    if (sortBy === "ticketPrice") return "Ticket price";
    if (sortBy === "winningPot") return "Winning pot";
    return "Remaining time";
  }, [sortBy]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">
              Explore
            </div>
            <div className="mt-1 text-2xl font-black text-white">Find a raffle</div>
            <div className="mt-1 text-sm font-bold text-white/70">
              Filter by status, then sort by price, pot, or remaining time.
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
              <Filter size={16} className="text-white/80" />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ExploreStatusFilter);
                  setPage(0);
                }}
                className="bg-transparent text-white font-black outline-none"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="FUNDING_PENDING">Funding</option>
                <option value="DRAWING">Drawing</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELED">Canceled</option>
                <option value="PAUSED">Paused</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
              <ArrowUpDown size={16} className="text-white/80" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as ExploreSortBy);
                  setPage(0);
                }}
                className="bg-transparent text-white font-black outline-none"
              >
                <option value="deadline">Remaining time</option>
                <option value="ticketPrice">Ticket price</option>
                <option value="winningPot">Winning pot</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  setPage(0);
                }}
                className="ml-1 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-2 text-[12px] font-black text-white transition"
                title="Toggle ascending/descending"
              >
                {sortLabel}: {sortDir.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading / error */}
      {q.isLoading ? (
        <div className="mt-6 rounded-3xl border border-white/15 bg-white/10 p-6 text-white font-black">
          Loading raffles…
        </div>
      ) : q.isError ? (
        <div className="mt-6 rounded-3xl border border-red-300/20 bg-red-400/10 p-6 text-red-50 font-black">
          Couldn’t load raffles from the subgraph.
        </div>
      ) : (
        <>
          {/* Result count */}
          <div className="mt-4 text-sm font-bold text-white/70">
            Showing {raffles.length} raffles {status !== "ALL" ? `(${status})` : ""}
          </div>

          {/* Grid */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {raffles.map((r) => (
              <RaffleCard
                key={(r as any).id}
                raffle={r as any}
                nowMs={nowMs}
                onOpen={onOpenRaffle}
                onOpenSafety={onOpenSafety}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={`rounded-2xl px-4 py-3 font-black border transition ${
                page === 0
                  ? "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                  : "bg-white/10 border-white/15 text-white hover:bg-white/15"
              }`}
            >
              Prev
            </button>

            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={raffles.length < pageSize}
              className={`rounded-2xl px-4 py-3 font-black border transition ${
                raffles.length < pageSize
                  ? "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                  : "bg-white/10 border-white/15 text-white hover:bg-white/15"
              }`}
              title={raffles.length < pageSize ? "No more results" : "Next page"}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}