// src/components/RaffleCard.tsx
import React, { useMemo } from "react";
import { formatUnits } from "ethers";
import "./RaffleCard.css";

// --- Types ---
// (Adjust based on your actual types from subgraph/indexer)
type RaffleData = {
  id: string;
  name: string;
  status: string;
  winningPot: string;
  ticketPrice: string;
  sold: string;
  maxTickets: string;
  deadline: string;
  creator: string;
  // ... other fields
};

type Props = {
  raffle: RaffleData;
  onOpen: (id: string) => void;
  onOpenSafety?: (id: string) => void;
  ribbon?: "gold" | "silver" | "bronze";
  nowMs?: number;
  // Optional hatch/action props if you use them
  hatch?: { show: boolean; label: string; onClick: () => void; disabled?: boolean };
};

// --- Helpers ---
const fmtUSDC = (val: string) => {
  try {
    const n = parseFloat(formatUnits(val || "0", 6));
    // Remove decimals if whole number for cleaner look
    return n % 1 === 0 
      ? "$" + n.toLocaleString("en-US") 
      : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch { return "$0"; }
};

const shortAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "";

export function RaffleCard({ raffle, onOpen, onOpenSafety, ribbon, nowMs = Date.now(), hatch }: Props) {
  
  // 1. Calculations
  const potDisplay = useMemo(() => fmtUSDC(raffle.winningPot), [raffle.winningPot]);
  const priceDisplay = useMemo(() => fmtUSDC(raffle.ticketPrice), [raffle.ticketPrice]);
  
  const sold = Number(raffle.sold || 0);
  const max = Number(raffle.maxTickets || 0);
  const pct = max > 0 ? Math.min(100, Math.round((sold / max) * 100)) : 0;

  // Time remaining
  const timeLeft = useMemo(() => {
    const end = Number(raffle.deadline || 0) * 1000;
    const diff = end - nowMs;
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m left`;
  }, [raffle.deadline, nowMs]);

  // Handle click: if clicking the badge, open safety; otherwise open raffle
  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenSafety) onOpenSafety(raffle.id);
  };

  return (
    <div className="rc-card" onClick={() => onOpen(raffle.id)}>
      
      {/* Ribbon for Podium */}
      {ribbon && <div className={`rc-ribbon ${ribbon}`}>{ribbon === "gold" ? "1st" : ribbon === "silver" ? "2nd" : "3rd"}</div>}

      {/* HEADER: Status + Verified Badge */}
      <div className="rc-header">
        <span className={`rc-status-pill ${raffle.status === "OPEN" ? "open" : "closed"}`}>
          {raffle.status === "FUNDING_PENDING" ? "Opening..." : raffle.status}
        </span>

        {/* ✅ NEW PROMINENT BADGE */}
        <div 
           className="rc-verified-badge" 
           onClick={handleBadgeClick} 
           title="Verified Randomness & Contract"
        >
          🛡️
        </div>
      </div>

      {/* BODY: THE PRIZE HERO */}
      <div className="rc-prize-section">
        <div className="rc-prize-label">Win This Pot</div>
        <div className="rc-prize-val">{potDisplay}</div>
        
        <div className="rc-host-row">
           <span style={{opacity: 0.5}}>by</span> 
           <span style={{textDecoration: 'underline'}}>{shortAddr(raffle.creator)}</span>
        </div>
      </div>

      {/* Visual Tear Line */}
      <div className="rc-tear" />

      {/* FOOTER: Stats */}
      <div className="rc-footer">
        
        <div className="rc-stat-grid">
           <div className="rc-stat">
              <div className="rc-stat-lbl">Ticket Price</div>
              <div className="rc-stat-val">{priceDisplay}</div>
           </div>
           <div className="rc-stat">
              <div className="rc-stat-lbl">Odds</div>
              <div className="rc-stat-val">1 in {sold + 1}</div>
           </div>
        </div>

        {/* Progress */}
        <div className="rc-progress-track">
           <div className="rc-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="rc-footer-meta">
           <span>{sold} / {max === 0 ? "∞" : max} sold</span>
           <span>{timeLeft}</span>
        </div>
        
        {/* Optional Hatch Action (for dashboard) */}
        {hatch?.show && (
           <button 
             className="rc-hatch-btn" // You can style this in CSS if needed
             onClick={(e) => { e.stopPropagation(); hatch.onClick(); }}
             disabled={hatch.disabled}
             style={{ width: "100%", marginTop: 12, padding: 10, borderRadius: 8, background: "#1e293b", color: "white", fontWeight: "bold", cursor: hatch.disabled ? "not-allowed" : "pointer", opacity: hatch.disabled ? 0.6 : 1 }}
           >
             {hatch.label}
           </button>
        )}

      </div>
    </div>
  );
}
