import React from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { useRaffleCard } from "../hooks/useRaffleCard";
import "./RaffleCard.css";

// ✅ Helper for Explorer URL
const EXPLORER_URL = "https://explorer.etherlink.com/address/";

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
  const { ui, actions } = useRaffleCard(raffle, nowMs);

  const statusClass = ui.displayStatus.toLowerCase().replace(" ", "-");
  const cardClass = `rc-card ${ribbon || ""}`;
  const showHatch = hatch && hatch.show;

  return (
    <div 
      className={cardClass}
      onClick={() => onOpen(raffle.id)}
      role="button"
      tabIndex={0}
    >
      {/* Decorations */}
      <div className="rc-notch left" />
      <div className="rc-notch right" />
      {ui.copyMsg && <div className="rc-toast">{ui.copyMsg}</div>}

      {/* Header */}
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

      <div className="rc-brand">Ppopgi Ticket</div>
      <div className="rc-title" title={raffle.name}>{raffle.name}</div>

      <div className="rc-prize-lbl">Winner Prize</div>
      <div className="rc-prize-val">{ui.formattedPot} USDC</div>

      <div className="rc-perforation" />

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

      {/* Footer with Clickable Address */}
      <div className="rc-footer">
        <span>{ui.isLive ? `Ends: ${ui.timeLeft}` : ui.displayStatus}</span>
        
        {/* ✅ CLICKABLE LINK */}
        <a 
          href={`${EXPLORER_URL}${raffle.id}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()} 
          style={{ 
            opacity: 0.6, 
            textDecoration: "none", 
            color: "inherit", 
            borderBottom: "1px dotted currentColor",
            cursor: "pointer"
          }}
          title="View Contract on Explorer"
        >
          #{raffle.id.slice(2, 8).toUpperCase()}
        </a>
      </div>
    </div>
  );
}
