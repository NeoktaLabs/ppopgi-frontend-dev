// src/components/RaffleCard.tsx
import React from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { useRaffleCard } from "../hooks/useRaffleCard";
import "./RaffleCard.css";

// --- Types (kept from your original file) ---
type HatchUI = {
  show: boolean;
  ready: boolean;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  note?: string | null;
};

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;
  onOpenSafety?: (id: string) => void;
  ribbon?: "gold" | "silver" | "bronze";
  nowMs?: number;
  hatch?: HatchUI | null;
};

export function RaffleCard({ raffle, onOpen, onOpenSafety, ribbon, nowMs = Date.now(), hatch }: Props) {
  // Use the hook for all logic
  const { ui, actions } = useRaffleCard(raffle, nowMs);

  const statusClass = ui.displayStatus.toLowerCase().replace(" ", "-");
  // Combine base class with optional ribbon class (e.g., "rc-card gold")
  const cardClass = `rc-card ${ribbon || ""}`;
  const showHatch = hatch && hatch.show;

  return (
    <div 
      className={cardClass}
      onClick={() => onOpen(raffle.id)}
      role="button"
      tabIndex={0}
    >
      {/* The deep ticket notches on the sides */}
      <div className="rc-notch left" />
      <div className="rc-notch right" />
      
      {ui.copyMsg && <div className="rc-toast">{ui.copyMsg}</div>}

      {/* Header: Status + Buttons */}
      <div className="rc-header">
        <div className={`rc-chip ${statusClass}`}>{ui.displayStatus}</div>
        <div className="rc-actions">
          <button 
            className="rc-btn-icon" 
            onClick={(e) => { e.stopPropagation(); onOpenSafety?.(raffle.id); }} 
            title="Safety Info"
            disabled={!onOpenSafety}
          >
            🛡️
          </button>
          <button className="rc-btn-icon" onClick={actions.handleShare} title="Share Link">
             🔗
          </button>
        </div>
      </div>

      {/* Title Section */}
      <div className="rc-brand">Ppopgi Ticket</div>
      <div className="rc-title" title={raffle.name}>{raffle.name}</div>

      {/* Prize Section */}
      <div className="rc-prize-lbl">Winner Prize</div>
      <div className="rc-prize-val">{ui.formattedPot} USDC</div>

      {/* The perforated tear line */}
      <div className="rc-perforation" />

      {/* "Ticket Stub" Bottom Section */}
      <div className="rc-grid">
        <div className="rc-stat">
          <div className="rc-stat-lbl">Price</div>
          <div className="rc-stat-val">{ui.formattedPrice} USDC</div>
        </div>
        <div className="rc-stat">
           <div className="rc-stat-lbl">Sold</div>
           <div className="rc-stat-val">
             {ui.sold} {ui.hasMax && `/ ${ui.max}`}
           </div>
        </div>
      </div>

      {/* Progress Bars (Only if live) */}
      {ui.isLive && ui.hasMin && (
        <div className="rc-bar-group">
          {!ui.minReached ? (
            <>
               <div className="rc-bar-row"><span>Min To Draw</span><span>{ui.sold} / {ui.min}</span></div>
               <div className="rc-track"><div className="rc-fill blue" style={{ width: ui.progressMinPct }} /></div>
            </>
          ) : (
            <>
               <div className="rc-bar-row"><span>Min Reached</span><span>Ready</span></div>
               <div className="rc-track"><div className="rc-fill green" style={{ width: "100%" }} /></div>
               
               <div className="rc-bar-row" style={{ marginTop: 8 }}><span>Capacity</span><span>{ui.hasMax ? `${ui.sold} / ${ui.max}` : "Unlimited"}</span></div>
               <div className="rc-track"><div className="rc-fill purple" style={{ width: ui.progressMaxPct }} /></div>
            </>
          )}
        </div>
      )}

      {/* Emergency Hatch UI */}
      {showHatch && (
        <div className="rc-hatch" onClick={e => e.stopPropagation()}>
           <div className="rc-bar-row">
              <span>⚠️ Emergency Hatch</span>
              <span>{hatch.label}</span>
           </div>
           <button 
             className={`rc-hatch-btn ${hatch.ready ? "ready" : ""}`}
             disabled={hatch.disabled || hatch.busy}
             onClick={hatch.onClick}
           >
             {hatch.busy ? "CONFIRMING..." : hatch.ready ? "HATCH (CANCEL)" : "LOCKED"}
           </button>
           {hatch.note && <div style={{ fontSize: 10, marginTop: 4, textAlign: "center", fontWeight: 800, textTransform: 'uppercase' }}>{hatch.note}</div>}
        </div>
      )}

      {/* Footer */}
      <div className="rc-footer">
        <span>{ui.isLive ? `Ends: ${ui.timeLeft}` : ui.displayStatus}</span>
        {/* Replaced sparkle emoji with a ticket ID look */}
        <span style={{ opacity: 0.6 }}>#{raffle.id.slice(2, 8).toUpperCase()}</span>
      </div>
    </div>
  );
}
