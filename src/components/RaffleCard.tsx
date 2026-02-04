// src/components/RaffleCard.tsx
import React, { useMemo } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { useRaffleCard } from "../hooks/useRaffleCard";
import "./RaffleCard.css";

const EXPLORER_URL = "https://explorer.etherlink.com/address/";
const USDC_ICON = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=026"; 

type HatchUI = {
  show: boolean;
  ready: boolean;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  note?: string | null;
};

// ✅ NEW: Stats type
export type UserEntryStats = {
  count: number;
  percentage: string;
};

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;
  onOpenSafety?: (id: string) => void;
  ribbon?: "gold" | "silver" | "bronze";
  nowMs?: number;
  hatch?: HatchUI | null;
  // ✅ NEW: Optional prop for dashboard view
  userEntry?: UserEntryStats; 
};

const short = (addr: string) => addr ? `${addr.slice(0, 5)}...${addr.slice(-4)}` : "Unknown";

export function RaffleCard({ raffle, onOpen, onOpenSafety, ribbon, nowMs = Date.now(), hatch, userEntry }: Props) {
  const { ui, actions } = useRaffleCard(raffle, nowMs);

  const statusClass = ui.displayStatus.toLowerCase().replace(" ", "-");
  const cardClass = `rc-card ${ribbon || ""}`;
  const showHatch = hatch && hatch.show;

  const hostAddr = (raffle as any).owner || (raffle as any).creator;

  // Calculate Win Chance (Odds for 1 Ticket)
  const odds = useMemo(() => {
    if (!ui.isLive) return null;
    const max = Number(raffle.maxTickets);
    const sold = Number(raffle.sold);
    
    // Fixed capacity
    if (max > 0) return { pct: (100 / max).toFixed(2), label: `1 in ${max}` };
    
    // Unlimited (dynamic odds)
    const pool = sold + 1; 
    return { pct: (100 / pool).toFixed(2), label: `1 in ~${pool}` };
  }, [raffle.maxTickets, raffle.sold, ui.isLive]);

  return (
    <div 
      className={cardClass}
      onClick={() => onOpen(raffle.id)}
      role="button"
      tabIndex={0}
    >
      <div className="rc-notch left" />
      <div className="rc-notch right" />
      {ui.copyMsg && <div className="rc-toast">{ui.copyMsg}</div>}
      
      {/* Ribbon (if provided) */}
      {ribbon && <div className={`rc-ribbon ${ribbon}`}>{ribbon}</div>}

      {/* Header */}
      <div className="rc-header">
        <div className={`rc-chip ${statusClass}`}>{ui.displayStatus}</div>
        
        {/* Win Chance Badge (Only show if NOT showing user stats to avoid clutter) */}
        {odds && !userEntry && (
           <div className="rc-odds-badge" title={`Win chance: ${odds.pct}% per ticket`}>
              🎲 {odds.pct}% Chance
           </div>
        )}

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

      {/* ✅ NEW: User Stats Badge (Replaces Odds Badge location visually) */}
      {userEntry && (
        <div className="rc-user-badge">
          🎟️ <strong>{userEntry.count}</strong> Owned ({userEntry.percentage}%)
        </div>
      )}

      <div className="rc-host">
        <span>Hosted by</span>
        {hostAddr ? (
           <a 
             href={`${EXPLORER_URL}${hostAddr}`}
             target="_blank"
             rel="noreferrer"
             className="rc-host-link"
             onClick={(e) => e.stopPropagation()}
           >
             {short(hostAddr)}
           </a>
        ) : <span>PPOPGI</span>}
      </div>

      <div className="rc-title" title={raffle.name}>{raffle.name}</div>

      <div className="rc-prize-lbl">Winner Prize</div>
      <div className="rc-prize-row">
        <img src={USDC_ICON} alt="USDC" className="rc-token-icon" />
        <div className="rc-prize-val">{ui.formattedPot}</div>
      </div>

      {/* Quick Buy Button */}
      <div className="rc-quick-buy-wrapper">
         <div className="rc-perforation" />
         {ui.isLive && (
            <button className="rc-quick-buy-btn" onClick={() => onOpen(raffle.id)}>
               ⚡ Buy Ticket
            </button>
         )}
      </div>

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

      <div className="rc-footer">
        <span>{ui.isLive ? `Ends: ${ui.timeLeft}` : ui.displayStatus}</span>
        
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
