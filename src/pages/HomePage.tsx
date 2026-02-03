import React, { useMemo } from "react";
import { useHomeRaffles } from "../hooks/useHomeRaffles";
import { RaffleCard } from "../components/RaffleCard";
import "./HomePage.css";

type Props = {
  nowMs: number;
  onOpenRaffle: (id: string) => void;
  onOpenSafety: (id: string) => void;
};

// Helper
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function HomePage({ nowMs, onOpenRaffle, onOpenSafety }: Props) {
  const { items, bigPrizes, endingSoon, note } = useHomeRaffles();

  // 1. Podium Logic
  const podium = useMemo(() => {
    const sorted = [...bigPrizes].sort((a, b) => {
        try { return BigInt(a.winningPot || "0") < BigInt(b.winningPot || "0") ? 1 : -1; } catch { return 0; }
    });
    return { gold: sorted[0], silver: sorted[1], bronze: sorted[2] };
  }, [bigPrizes]);

  // 2. Ending Soon Logic
  const endingSoonSorted = useMemo(() => [...endingSoon].sort((a, b) => num(a.deadline) - num(b.deadline)), [endingSoon]);

  // 3. Terminated Logic
  const latestTerminated = useMemo(() => {
    const all = items ?? [];
    return all.filter(r => r.status !== "OPEN" && r.status !== "FUNDING_PENDING")
      .sort((a, b) => {
         const getT = (r: any) => Math.max(num(r.finalizedAt), num(r.completedAt), num(r.canceledAt));
         return getT(b) - getT(a);
      }).slice(0, 5);
  }, [items]);

  return (
    <>
      {note && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.92 }}>{note}</div>}

      {/* SECTION 1: PODIUM */}
      <div className="hp-section">
        <div className="hp-inner-stroke" />
        <div className="hp-accent" />
        <div className="hp-title-row">
          <div className="hp-pill"><span className="hp-notch" />🏆 Big prizes</div>
        </div>
        <div className="hp-podium">
            {podium.silver && <div className="pp-podium__silver"><RaffleCard raffle={podium.silver} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} ribbon="silver" nowMs={nowMs} /></div>}
            {podium.gold && <div className="pp-podium__gold"><RaffleCard raffle={podium.gold} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} ribbon="gold" nowMs={nowMs} /></div>}
            {podium.bronze && <div className="pp-podium__bronze"><RaffleCard raffle={podium.bronze} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} ribbon="bronze" nowMs={nowMs} /></div>}
        </div>
      </div>

      {/* SECTION 2: ENDING SOON */}
      <div className="hp-section">
        <div className="hp-inner-stroke" /><div className="hp-accent" />
        <div className="hp-title-row"><div className="hp-pill"><span className="hp-notch" />⏳ Ending soon</div></div>
        <div className="hp-scroll-row">
            {endingSoonSorted.map(r => <div key={r.id} className="hp-scroll-item"><RaffleCard raffle={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} nowMs={nowMs} /></div>)}
            {endingSoonSorted.length === 0 && <div style={{ padding: 10, opacity: 0.8 }}>Nothing ending soon.</div>}
        </div>
      </div>

      {/* SECTION 3: HISTORY */}
      <div className="hp-section">
        <div className="hp-inner-stroke" /><div className="hp-accent" />
        <div className="hp-title-row"><div className="hp-pill"><span className="hp-notch" />🧾 Latest terminated</div></div>
        <div className="hp-scroll-row">
            {latestTerminated.map(r => <div key={r.id} className="hp-scroll-item"><RaffleCard raffle={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} nowMs={nowMs} /></div>)}
        </div>
      </div>
    </>
  );
}
