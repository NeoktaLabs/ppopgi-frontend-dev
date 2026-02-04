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
  userEntry?: UserEntryStats; 
};

const short = (addr: string) => addr ? `${addr.slice(0, 5)}...${addr.slice(-4)}` : "Unknown";

export function RaffleCard({ raffle, onOpen, onOpenSafety, ribbon, nowMs = Date.now(), hatch, userEntry }: Props) {
  const { ui, actions } = useRaffleCard(raffle, nowMs);

  const statusClass = ui.displayStatus.toLowerCase().replace(" ", "-");
  
  // ✅ 1. Ribbon handles class only, logic to render text is removed below
  const cardClass = `rc-card ${ribbon || ""}`;
  const showHatch = hatch && hatch.show;

  const hostAddr = (raffle as any).owner || (raffle as any).creator;

  // ✅ 2. Odds as Percentage
  const oddsLabel = useMemo(() => {
    if (!ui.isLive) return null;
    const max = Number(raffle.maxTickets);
    const sold = Number(raffle.sold);
    
    // Calculate denominator (Total pool size)
    // If capped (max > 0), odds are fixed at 1/Max. 
    // If uncapped (max == 0), odds are 1/(Sold + You).
    const denominator = max > 0 ? max : sold + 1;
    
    if (denominator === 0) return "0%"; // Safety

    const pct = (1 / denominator) * 100;

    // Formatting
    if (pct >= 100) return "100%";
    if (pct < 0.01) return "< 0.01%";
    // Show decimals only if needed (e.g. 0.5% vs 50%)
    return pct < 1 ? `${pct.toFixed(2)}%` : `${Math.round(pct)}%`;
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
      
      {/* ✅ REMOVED: The block that rendered {ribbon} text is deleted */}

      {/* Header */}
      <div className="rc-header">
        <div className={`rc-chip ${statusClass}`}>{ui.displayStatus}</div>
        
        {/* Updated Label */}
        {oddsLabel && !userEntry && (
           <div className="rc-odds-badge" title="Your chance to win if you buy 1 ticket">
              🎲 Win Chance: {oddsLabel}
           </div>
        )}

        <div className="rc-actions">
          <button 
            className="rc-shield-btn" 
            onClick={(e) => { e.stopPropagation(); onOpenSafety?.(raffle.id); }} 
            title="Verified Contract"
            disabled={!onOpenSafety}
          >
            🛡
          </button>
          <button className="rc-btn-icon" onClick={actions.handleShare} title="Share">
             🔗
          </button>
        </div>
      </div>

      {userEntry && (
        <div className="rc-user-badge">
          🎟️ <strong>{userEntry.count}</strong> Owned ({userEntry.percentage}%)
        </div>
      )}

      <div className="rc-host">
        <span>Created by</span>
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
          <div className="rc-stat-lbl">Ticket Price</div>
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

      {/* ✅ 3. Footer Layout Change */}
      <div className="rc-footer">
        {/* Only Time and Barcode here */}
        <span>{ui.isLive ? `Ends: ${ui.timeLeft}` : ui.displayStatus}</span>
        {/* CSS ::after handles the barcode on the right */}
      </div>

      {/* ID Link: Moved below the barcode/footer */}
      <div style={{ textAlign: 'center', marginTop: -12, paddingBottom: 6 }}>
        <a 
          href={`${EXPLORER_URL}${raffle.id}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()} 
          style={{ fontSize: 10, fontWeight: 900, opacity: 0.4, textDecoration: "none", color: "inherit", letterSpacing: 1 }}
          title="View Contract"
        >
          #{raffle.id.slice(2, 8).toUpperCase()}
        </a>
      </div>

    </div>
  );
}
