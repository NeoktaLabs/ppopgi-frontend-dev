// src/components/RaffleDetailsModal.tsx
import React, { useMemo } from "react";
import { useRaffleInteraction } from "../hooks/useRaffleInteraction";
import type { RaffleListItem } from "../indexer/subgraph"; 
import "./RaffleDetailsModal.css";

// Helper for clickable addresses
const ExplorerLink = ({ addr, children }: { addr: string; children: React.ReactNode }) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return <span>{children}</span>;
  return (
    <a href={`https://explorer.etherlink.com/address/${addr}`} target="_blank" rel="noreferrer" className="rdm-info-link">
      {children}
    </a>
  );
};

// Date Formatter
const formatDate = (ts: any) => {
  if (!ts || ts === "0") return "—";
  return new Date(Number(ts) * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

type Props = {
  open: boolean;
  raffleId: string | null;
  onClose: () => void;
  initialRaffle?: RaffleListItem | null; // This comes from the Indexer
};

export function RaffleDetailsModal({ open, raffleId, onClose, initialRaffle }: Props) {
  const { state, math, flags, actions } = useRaffleInteraction(raffleId, open);

  // 1. Merge Data: Prefer Live Data for status, but keep Indexer data for static fields
  const displayData = state.data || initialRaffle;

  // 2. TIMESTAMPS: Always prefer the Indexer (initialRaffle) because the Blockchain doesn't store 'createdAt'
  const createdTs = initialRaffle?.createdAtTimestamp || state.data?.createdAtTimestamp;
  
  // For deadline, we prefer the live contract data in case it was extended, but fallback to indexer
  const deadlineTs = state.data?.deadline || initialRaffle?.deadline;

  const stats = useMemo(() => {
    if (!displayData) return null;
    const pot = parseFloat(math.fmtUsdc(displayData.winningPot || "0"));
    const price = parseFloat(math.fmtUsdc(displayData.ticketPrice || "0"));
    const sold = Number(displayData.sold || "0");
    const max = Number(displayData.maxTickets || "0");
    
    const roi = price > 0 ? (pot / price).toFixed(1) : "0";
    const odds = sold > 0 ? `1 in ${sold + 1}` : "100%";
    
    return { roi, odds, pot, price, max };
  }, [displayData, math]);

  if (!open) return null;

  return (
    <div className="rdm-overlay" onMouseDown={onClose}>
      <div className="rdm-card" onMouseDown={(e) => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className="rdm-header">
           <div style={{ display: 'flex', gap: 8 }}>
             <button className="rdm-close-btn" onClick={actions.handleShare} title="Copy Link">🔗</button>
           </div>
           <div style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              TICKET #{raffleId?.slice(2, 8).toUpperCase()}
           </div>
           <button className="rdm-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* HERO */}
        <div className="rdm-hero">
           <div className="rdm-hero-lbl">Current Prize Pot</div>
           <div className="rdm-hero-val">{math.fmtUsdc(displayData?.winningPot || "0")}</div>
           <div className="rdm-host">
              <span>Hosted by</span>
              <ExplorerLink addr={displayData?.owner || displayData?.creator || ""}>
                 {math.short(displayData?.owner || displayData?.creator || "")}
              </ExplorerLink>
           </div>
        </div>

        {/* STATS */}
        {stats && (
          <div className="rdm-stats-grid">
             <div className="rdm-stat-box highlight">
                <div className="rdm-sb-lbl">Payout</div>
                <div className="rdm-sb-val rdm-roi-badge">{stats.roi}x</div>
             </div>
             <div className="rdm-stat-box">
                <div className="rdm-sb-lbl">Win Odds</div>
                <div className="rdm-sb-val">{stats.odds}</div>
             </div>
             <div className="rdm-stat-box">
                <div className="rdm-sb-lbl">Price</div>
                <div className="rdm-sb-val">${stats.price}</div>
             </div>
          </div>
        )}

        <div className="rdm-tear" />

        {/* BUY SECTION */}
        <div className="rdm-buy-section">
           {!flags.raffleIsOpen ? (
              <div style={{ textAlign: 'center', padding: 20, opacity: 0.6, fontWeight: 700 }}>
                 {state.displayStatus === "Open" ? "Raffle is finalizing..." : "Raffle Closed"}
              </div>
           ) : (
             <>
               <div className="rdm-balance-row">
                  <span>Bal: {math.fmtUsdc(state.usdcBal?.toString() || "0")}</span>
                  <span>Max: {math.maxBuy} Tickets</span>
               </div>
               <div className="rdm-stepper">
                  <button className="rdm-step-btn" onClick={() => actions.setTickets(String(math.ticketCount - 1))}>−</button>
                  <div className="rdm-input-wrapper">
                     <input className="rdm-amount" value={state.tickets} onChange={(e) => actions.setTickets(e.target.value)} placeholder="1" />
                     <div className="rdm-cost-preview">Total: {math.fmtUsdc(math.totalCostU.toString())} USDC</div>
                  </div>
                  <button className="rdm-step-btn" onClick={() => actions.setTickets(String(math.ticketCount + 1))}>+</button>
               </div>
               {!flags.hasEnoughAllowance ? (
                  <button className="rdm-cta approve" onClick={actions.approve} disabled={state.isPending}>{state.isPending ? "Approving..." : "1. Approve USDC"}</button>
               ) : (
                  <button className="rdm-cta buy" onClick={actions.buy} disabled={!flags.canBuy || state.isPending}>{state.isPending ? "Confirming..." : `Buy ${state.tickets} Ticket${math.ticketCount!==1?'s':''}`}</button>
               )}
               {state.buyMsg && <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#D32F2F', fontWeight: 700 }}>{state.buyMsg}</div>}
             </>
           )}
        </div>

        {/* TECHNICAL RECEIPT */}
        {displayData && (
           <div className="rdm-receipt">
              <div className="rdm-receipt-title">TECHNICAL SPECS</div>
              
              <div className="rdm-info-row"><span>Status</span><span className="rdm-info-val">{state.displayStatus}</span></div>
              
              {/* ✅ USING INDEXER TIMESTAMP */}
              <div className="rdm-info-row"><span>Created</span><span className="rdm-info-val">{formatDate(createdTs)}</span></div>
              <div className="rdm-info-row"><span>Draw Deadline</span><span className="rdm-info-val">{formatDate(deadlineTs)}</span></div>
              
              <div className="rdm-info-row"><span>Tickets Sold</span><span className="rdm-info-val">{displayData.sold} / {displayData.maxTickets === "0" ? "∞" : displayData.maxTickets}</span></div>
              
              <div className="rdm-info-row" style={{ marginTop: 12 }}>
                 <span>Randomness</span>
                 <span className="rdm-info-val">
                    <ExplorerLink addr={displayData.entropyProvider}>{math.short(displayData.entropyProvider)}</ExplorerLink>
                 </span>
              </div>
              
              <div className="rdm-info-row">
                 <span>Contract</span>
                 <span className="rdm-info-val">
                    <ExplorerLink addr={raffleId || ""}>{math.short(raffleId || "")}</ExplorerLink>
                 </span>
              </div>
           </div>
        )}

      </div>
    </div>
  );
}
