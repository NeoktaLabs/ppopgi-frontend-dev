import React from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { useRaffleCard } from "../hooks/useRaffleCard";
import "./RaffleCard.css";

type HatchUI = {
  show: boolean; ready: boolean; label: string;
  disabled?: boolean; busy?: boolean; onClick?: (e: React.MouseEvent) => void; note?: string | null;
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

  return (
    <div 
      className={cardClass}
      onClick={() => onOpen(raffle.id)}
      role="button"
    >
      {/* Decorations */}
      <div className="rc-notch" style={{ left: -10 }} />
      <div className="rc-notch" style={{ right: -10 }} />
      {ui.copyMsg && <div className="rc-toast">{ui.copyMsg}</div>}

      {/* Header */}
      <div className="rc-top">
        <div className={`rc-chip ${statusClass}`}>{ui.displayStatus}</div>
        <div className="rc-actions">
          {onOpenSafety && (
            <button className="rc-btn-icon" onClick={(e) => { e.stopPropagation(); onOpenSafety(raffle.id); }} title="Safety">
              🛡️
            </button>
          )}
          <button className="rc-btn-icon" onClick={actions.handleShare} title="Share">
             🔗
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="rc-title-block">
        <div className="rc-brand">Ppopgi</div>
        <div className="rc-title" title={raffle.name}>{raffle.name}</div>
      </div>

      {/* Prize */}
      <div className="rc-prize-lbl">Winner Gets</div>
      <div className="rc-prize-val">{ui.formattedPot} USDC</div>

      <div className="rc-tear" />

      {/* Stats */}
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
               <div className="rc-bar-row"><span>Min Needed</span><span>{ui.sold} / {ui.min}</span></div>
               <div className="rc-track"><div className="rc-fill blue" style={{ width: ui.progressMinPct }} /></div>
            </>
          ) : (
            <>
               <div className="rc-bar-row"><span>Min Reached</span><span>Target Met</span></div>
               <div className="rc-track"><div className="rc-fill green" style={{ width: "100%" }} /></div>
               
               <div className="rc-bar-row" style={{ marginTop: 4 }}><span>Capacity</span><span>{ui.sold} / {ui.hasMax ? ui.max : "∞"}</span></div>
               <div className="rc-track"><div className="rc-fill purple" style={{ width: ui.progressMaxPct }} /></div>
            </>
          )}
        </div>
      )}

      {/* Emergency Hatch (Optional) */}
      {hatch && hatch.show && (
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
             {hatch.busy ? "Confirming..." : hatch.ready ? "Hatch Now" : "Locked"}
           </button>
           {hatch.note && <div style={{ fontSize: 10, marginTop: 4, textAlign: "center" }}>{hatch.note}</div>}
        </div>
      )}

      {/* Footer */}
      <div className="rc-footer">
        <span>{ui.isLive ? `Ends in ${ui.timeLeft}` : ui.displayStatus}</span>
        <span style={{ fontSize: 18 }}>✨</span>
      </div>
    </div>
  );
}
