// src/pages/HomePage.tsx
import React, { useMemo } from "react";
import { formatUnits } from "ethers";
import { useHomeRaffles } from "../hooks/useHomeRaffles";
import { RaffleCard } from "../components/RaffleCard";
import { RaffleCardSkeleton } from "../components/RaffleCardSkeleton";
import { ActivityTicker } from "../components/ActivityTicker"; 
import "./HomePage.css";

type Props = {
  nowMs: number;
  onOpenRaffle: (id: string) => void;
  onOpenSafety: (id: string) => void;
};

// Formatting Helper
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmtUsd = (val: bigint) => {
  try {
    const s = formatUnits(val, 6);
    const n = parseFloat(s);
    // Compact format: $1.2K, $500K
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
  } catch { return "$0"; }
};

export function HomePage({ nowMs, onOpenRaffle, onOpenSafety }: Props) {
  const { items, bigPrizes, endingSoon, stats, isLoading } = useHomeRaffles();

  // Podium Logic
  const podium = useMemo(() => {
    if (!bigPrizes || bigPrizes.length === 0) return { gold: null, silver: null, bronze: null };
    const sorted = [...bigPrizes].sort((a, b) => {
        try { return BigInt(a.winningPot || "0") < BigInt(b.winningPot || "0") ? 1 : -1; } catch { return 0; }
    });
    return { gold: sorted[0], silver: sorted[1], bronze: sorted[2] };
  }, [bigPrizes]);

  // Ending Soon Logic
  const endingSoonSorted = useMemo(() => {
    if (!endingSoon) return [];
    return [...endingSoon].sort((a, b) => num(a.deadline) - num(b.deadline));
  }, [endingSoon]);

  return (
    <>
      <ActivityTicker />

      <div className="hp-container">
        
        {/* 1. HERO SPOTLIGHT */}
        <div className="hp-hero">
          <h1 className="hp-hero-title">Fairness You Can Verify.</h1>
          <div className="hp-hero-sub">
            The fully on-chain raffle protocol. Provably fair, non-custodial, and transparent.
          </div>
          
          {/* ✅ NEW: PLATFORM STATS BAR */}
          <div className="hp-stats-bar">
             <div className="hp-stat-item">
                <div className="hp-stat-val">{isLoading ? "..." : stats.totalRaffles}</div>
                <div className="hp-stat-lbl">Raffles Created</div>
             </div>
             <div className="hp-stat-sep" />
             <div className="hp-stat-item">
                <div className="hp-stat-val">{isLoading ? "..." : stats.settled}</div>
                <div className="hp-stat-lbl">Prizes Settled</div>
             </div>
             <div className="hp-stat-sep" />
             <div className="hp-stat-item highlight">
                <div className="hp-stat-val">{isLoading ? "..." : fmtUsd(stats.volume)}</div>
                <div className="hp-stat-lbl">Total Volume</div>
             </div>
          </div>
        </div>

        {/* 2. THE PODIUM */}
        <div className="hp-podium-section">
          <div className="hp-section-header" style={{ justifyContent: 'center', marginBottom: 20 }}>
             <div className="hp-section-title">🏆 Top Prizepools</div>
          </div>

          <div className="hp-podium">
            {isLoading && (
              <>
                 <div className="pp-silver-wrapper"><RaffleCardSkeleton /></div>
                 <div className="pp-gold-wrapper"><RaffleCardSkeleton /></div>
                 <div className="pp-bronze-wrapper"><RaffleCardSkeleton /></div>
              </>
            )}

            {!isLoading && podium.silver && (
               <div className="pp-silver-wrapper">
                 <RaffleCard raffle={podium.silver} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} ribbon="silver" nowMs={nowMs} />
               </div>
            )}

            {!isLoading && podium.gold && (
               <div className="pp-gold-wrapper">
                 <div className="hp-crown">👑</div>
                 <RaffleCard raffle={podium.gold} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} ribbon="gold" nowMs={nowMs} />
               </div>
            )}

            {!isLoading && podium.bronze && (
               <div className="pp-bronze-wrapper">
                 <RaffleCard raffle={podium.bronze} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} ribbon="bronze" nowMs={nowMs} />
               </div>
            )}
          </div>
        </div>

        {/* 3. ENDING SOON */}
        <div>
          <div className="hp-section-header">
             <div className="hp-section-title">⏳ Ending Soon</div>
             <div className="hp-section-line" />
          </div>
          
          <div className="hp-strip">
             {isLoading && Array.from({length: 4}).map((_, i) => (
               <div key={i} className="hp-strip-item"><RaffleCardSkeleton /></div>
             ))}

             {!isLoading && endingSoonSorted.map(r => (
               <div key={r.id} className="hp-strip-item">
                 <RaffleCard raffle={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} nowMs={nowMs} />
               </div>
             ))}
             {!isLoading && endingSoonSorted.length === 0 && <div className="hp-empty-msg">No raffles ending soon.</div>}
          </div>
        </div>

      </div>
    </>
  );
}
