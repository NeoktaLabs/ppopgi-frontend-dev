// src/components/RaffleDetailsModal.tsx
import React, { useState, useMemo } from "react";
import { ADDRESSES } from "../config/contracts";
import { useRaffleInteraction } from "../hooks/useRaffleInteraction";
import "./RaffleDetailsModal.css";

// Helper for clickable addresses
const ExplorerLink = ({ addr, children }: { addr: string; children: React.ReactNode }) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return <span>{children}</span>;
  return (
    <a href={`https://explorer.etherlink.com/address/${addr}`} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
};

type Props = {
  open: boolean;
  raffleId: string | null;
  onClose: () => void;
};

export function RaffleDetailsModal({ open, raffleId, onClose }: Props) {
  const { state, math, flags, actions } = useRaffleInteraction(raffleId, open);
  const [safetyOpen, setSafetyOpen] = useState(false);

  // --- 1. SMART STATS CALCULATOR ---
  const stats = useMemo(() => {
    if (!state.data) return null;
    
    // Convert to numbers for estimates
    const pot = parseFloat(math.fmtUsdc(state.data.winningPot || "0"));
    const price = parseFloat(math.fmtUsdc(state.data.ticketPrice || "0"));
    const sold = Number(state.data.sold || "0");
    const max = Number(state.data.maxTickets || "0");

    // ROI: (Pot / Price) x
    const roi = price > 0 ? (pot / price).toFixed(1) : "0";
    
    // Odds: 1 in (Sold + 1)
    const odds = sold > 0 ? `1 in ${sold + 1}` : "100%";
    
    // Fill %
    const fillPct = max > 0 ? Math.round((sold / max) * 100) : 0;

    return { roi, odds, fillPct, pot, price };
  }, [state.data, math]);

  if (!open) return null;

  return (
    <div className="rdm-overlay" onMouseDown={onClose}>
      <div className="rdm-card" onMouseDown={(e) => e.stopPropagation()}>
        
        {/* HEADER: Nav & Tools */}
        <div className="rdm-header">
           <div style={{ display: 'flex', gap: 8 }}>
             <button className="rdm-close-btn" onClick={actions.handleShare} title="Copy Link">🔗</button>
             {/* Note: In a real app, clicking Safety should open the other modal. 
                 For now, we just show a toast or log it since SafetyModal is global. */}
           </div>
           <div style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              TICKET #{raffleId?.slice(2, 8).toUpperCase()}
           </div>
           <button className="rdm-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* HERO: The Prize */}
        <div className="rdm-hero">
           <div className="rdm-hero-lbl">Current Prize Pot</div>
           <div className="rdm-hero-val">{math.fmtUsdc(state.data?.winningPot || "0")}</div>
           <div className="rdm-host">
              <span>Hosted by</span>
              <ExplorerLink addr={state.data?.owner || state.data?.creator || ""}>
                 {math.short(state.data?.owner || state.data?.creator || "")}
              </ExplorerLink>
           </div>
        </div>

        {/* STATS: ROI & Odds */}
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

        {/* ACTION: The Cashier */}
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
                     <input 
                       className="rdm-amount" 
                       value={state.tickets} 
                       onChange={(e) => actions.setTickets(e.target.value)}
                       placeholder="1"
                     />
                     <div className="rdm-cost-preview">
                        Total: {math.fmtUsdc(math.totalCostU.toString())} USDC
                     </div>
                  </div>
                  <button className="rdm-step-btn" onClick={() => actions.setTickets(String(math.ticketCount + 1))}>+</button>
               </div>

               {!flags.hasEnoughAllowance ? (
                  <button className="rdm-cta approve" onClick={actions.approve} disabled={state.isPending}>
                     {state.isPending ? "Approving USDC..." : "1. Approve USDC"}
                  </button>
               ) : (
                  <button className="rdm-cta buy" onClick={actions.buy} disabled={!flags.canBuy || state.isPending}>
                     {state.isPending ? "Confirming..." : `Buy ${state.tickets || 1} Ticket${math.ticketCount !== 1 ? 's' : ''}`}
                  </button>
               )}
               
               {state.buyMsg && <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#D32F2F', fontWeight: 700 }}>{state.buyMsg}</div>}
             </>
           )}
        </div>

        {/* FOOTER: Details */}
        <div className="rdm-footer">
           <span>Status: {state.displayStatus}</span>
           <span>Sold: {state.data?.sold} / {state.data?.maxTickets === "0" ? "∞" : state.data?.maxTickets}</span>
        </div>

      </div>
    </div>
  );
}
