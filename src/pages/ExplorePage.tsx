// src/pages/ExplorePage.tsx
import { useEffect } from "react";
import { RaffleCard } from "../components/RaffleCard";
import { RaffleCardSkeleton } from "../components/RaffleCardSkeleton";
import { useExploreController, type SortMode } from "../hooks/useExploreController";
import "./ExplorePage.css";

type Props = {
  onOpenRaffle: (id: string) => void; // can rename later to onOpenLottery
  onOpenSafety: (id: string) => void;
};

export function ExplorePage({ onOpenRaffle, onOpenSafety }: Props) {
  useEffect(() => {
    document.title = "Ppopgi 뽑기 — Explore";
  }, []);

  const { state, actions, meta } = useExploreController();

  const hasAnyItems = (state.items?.length ?? 0) > 0;
  const showSkeletons = meta.isLoading && !hasAnyItems;

  const isSearching = !!state.q;
  const isMyLotteries = state.myLotteriesOnly;

  return (
    <div className="xp-container">
      {/* 1. Header Section */}
      <div className="xp-header">
        <h1 className="xp-title">Explore Lotteries</h1>
        <div className="xp-subtitle">Discover active prize pools, verify fairness, and try your luck.</div>

        <div className="xp-stats-pill">
          {meta.isLoading && !hasAnyItems ? (
            "Syncing..."
          ) : (
            <>
              <strong>{meta.totalCount}</strong> Total • <strong>{meta.shownCount}</strong> Shown
            </>
          )}
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div className="xp-toolbar-wrapper">
        <div className="xp-toolbar">
          {/* Top Row: Search & Sort */}
          <div className="xp-toolbar-row main">
            <div className="xp-search-group">
              <span className="xp-search-icon">🔍</span>
              <input
                className="xp-search-input"
                value={state.q}
                onChange={(e) => actions.setQ(e.target.value)}
                placeholder="Search by name, address..."
              />
              {state.q && (
                <button className="xp-clear-btn" onClick={() => actions.setQ("")}>
                  ✕
                </button>
              )}
            </div>

            <div className="xp-select-group">
              {/* Status Select */}
              <div className="xp-select-wrapper">
                <select
                  className="xp-select"
                  value={state.status}
                  onChange={(e) => actions.setStatus(e.target.value as any)}
                >
                  <option value="ALL">All Status</option>
                  <option value="OPEN">Open</option>
                  <option value="COMPLETED">Settled</option>
                  <option value="CANCELED">Canceled</option>
                </select>
                <div className="xp-select-arrow">▼</div>
              </div>

              {/* Sort Select */}
              <div className="xp-select-wrapper">
                <select className="xp-select" value={state.sort} onChange={(e) => actions.setSort(e.target.value as SortMode)}>
                  <option value="endingSoon">⏳ Ending Soon</option>
                  <option value="bigPrize">🏆 Big Prize</option>
                  <option value="newest">✨ Newest</option>
                </select>
                <div className="xp-select-arrow">▼</div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Toggles */}
          <div className="xp-toolbar-row secondary">
            <div className="xp-toggle-group">
              <button
                className={`xp-toggle-btn ${state.openOnly ? "active" : ""}`}
                onClick={() => actions.setOpenOnly(!state.openOnly)}
              >
                {state.openOnly ? "✅ Open Only" : "All Statuses"}
              </button>

              <button
                className={`xp-toggle-btn ${state.myLotteriesOnly ? "active" : ""}`}
                onClick={() => actions.setMyLotteriesOnly(!state.myLotteriesOnly)}
                disabled={!state.me}
                title={!state.me ? "Sign in to view your lotteries" : ""}
              >
                {state.myLotteriesOnly ? "👤 My Lotteries" : "🌏 Everyone"}
              </button>
            </div>

            {(state.q || state.status !== "ALL" || state.openOnly || state.myLotteriesOnly) && (
              <button className="xp-reset-link" onClick={actions.resetFilters}>
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Results Grid */}
      <div className="xp-results">
        {/* Skeletons */}
        {showSkeletons && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="xp-card-shell" style={{ animationDelay: `${i * 0.05}s` }}>
                <RaffleCardSkeleton />
              </div>
            ))}
          </>
        )}

        {/* Real Cards */}
        {state.list.map((r, i) => (
          <div key={r.id} className="xp-card-shell" style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
            <RaffleCard lottery={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} />
          </div>
        ))}

        {/* Empty State */}
        {!meta.isLoading && state.list.length === 0 && (
          <div className="xp-empty-state">
            <div className="xp-empty-icon">{isSearching ? "🔍" : isMyLotteries ? "📂" : "🍃"}</div>
            <div className="xp-empty-title">
              {isSearching ? "No results found" : isMyLotteries ? "No lotteries found" : "No active lotteries"}
            </div>
            <div className="xp-empty-sub">
              {isSearching
                ? `We couldn't find anything matching "${state.q}".`
                : isMyLotteries
                  ? "You haven't created any lotteries matching these filters."
                  : "Try adjusting your filters to see more results."}
            </div>
            <button className="xp-empty-action" onClick={actions.resetFilters}>
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}