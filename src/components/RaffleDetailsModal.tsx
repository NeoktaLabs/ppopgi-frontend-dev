// src/components/RaffleDetailsModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useRaffleInteraction } from "../hooks/useRaffleInteraction";
import { useRaffleParticipants } from "../hooks/useRaffleParticipants"; 
import { fetchRaffleMetadata, type RaffleListItem } from "../indexer/subgraph"; 
import "./RaffleDetailsModal.css";

// Helper for clickable addresses
const ExplorerLink = ({ addr, label }: { addr: string; label?: string }) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return <span>{label || "—"}</span>;
  return (
    <a href={`https://explorer.etherlink.com/address/${addr}`} target="_blank" rel="noreferrer" className="rdm-info-link">
      {label || `${addr.slice(0,6)}...${addr.slice(-4)}`}
    </a>
  );
};

const TxLink = ({ hash }: { hash?: string }) => {
  if (!hash) return null;
  return <a href={`https://explorer.etherlink.com/tx/${hash}`} target="_blank" rel="noreferrer" className="rdm-tl-tx">View Tx ↗</a>;
};

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
  initialRaffle?: RaffleListItem | null;
};

export function RaffleDetailsModal({ open, raffleId, onClose, initialRaffle }: Props) {
  const { state, math, flags, actions } = useRaffleInteraction(raffleId, open);
  const [tab, setTab] = useState<"receipt" | "holders">("receipt");
  const [metadata, setMetadata] = useState<Partial<RaffleListItem> | null>(null);

  // Self-healing metadata fetch
  useEffect(() => {
    if (!raffleId || !open) {
      setMetadata(null);
      setTab("receipt");
      return;
    }
    if (initialRaffle?.createdAtTimestamp) {
      setMetadata(initialRaffle);
      return;
    }
    let active = true;
    fetchRaffleMetadata(raffleId).then((data) => {
      if (active && data) setMetadata(data);
    });
    return () => { active = false; };
  }, [raffleId, open, initialRaffle]);

  const displayData = state.data || initialRaffle || metadata;
  
  const { participants, isLoading: loadingPart } = useRaffleParticipants(
    raffleId, 
    Number(displayData?.sold || 0)
  );

  // --- BUILD TIMELINE ---
  const timeline = useMemo(() => {
    if (!displayData) return [];
    
    const steps = [];

    // 1. Initialization
    steps.push({ label: "Initialized", date: displayData.createdAtTimestamp, tx: displayData.creationTx, status: "done" });

    // 2. Registration
    if (displayData.registeredAt) {
      steps.push({ label: "Registered on Factory", date: displayData.registeredAt, status: "done" });
    }

    const isCompleted = displayData.status === "COMPLETED";
    const isDrawing = displayData.status === "DRAWING" || isCompleted;
    const isOpen = displayData.status === "OPEN" || isDrawing;

    // 3. Sales Period
    steps.push({ label: "Ticket Sales Open", date: displayData.createdAtTimestamp, status: isOpen ? (isDrawing ? "done" : "active") : "future" });

    // 4. Drawing Phase
    if (displayData.finalizedAt) {
       steps.push({ label: "Randomness Requested", date: displayData.finalizedAt, status: "done" });
    } else {
       steps.push({ label: "Draw Deadline", date: displayData.deadline, status: isDrawing ? "active" : "future" });
    }

    // 5. Completion
    if (displayData.completedAt) {
       steps.push({ label: "Winner Selected", date: displayData.completedAt, status: "done", winner: displayData.winner });
    } else {
       steps.push({ label: "Settlement", date: null, status: "future" });
    }
    return steps;
  }, [displayData]);

  // Stats
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
              <ExplorerLink addr={displayData?.owner || displayData?.creator || ""} label={math.short(displayData?.owner || displayData?.creator || "")} />
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

        {/* TABS */}
        <div className="rdm-tab-group">
           <button className={`rdm-tab-btn ${tab === 'receipt' ? 'active' : ''}`} onClick={() => setTab('receipt')}>Lifecycle</button>
           <button className={`rdm-tab-btn ${tab === 'holders' ? 'active' : ''}`} onClick={() => setTab('holders')}>Top Holders</button>
        </div>

        {/* TAB CONTENT */}
        <div className="rdm-scroll-content">
          {tab === 'receipt' && (
             <div className="rdm-receipt">
                <div className="rdm-receipt-title" style={{ marginBottom: 0 }}>BLOCKCHAIN JOURNEY</div>
                <div className="rdm-timeline">
                   {timeline.map((step, i) => (
                      <div key={i} className={`rdm-tl-item ${step.status}`}>
                         <div className="rdm-tl-dot" />
                         <div className="rdm-tl-title">{step.label}</div>
                         <div className="rdm-tl-date">{formatDate(step.date)} <TxLink hash={step.tx} /></div>
                         {step.winner && <div className="rdm-tl-winner-box"><span>🏆 Winner:</span> <ExplorerLink addr={step.winner} /></div>}
                      </div>
                   ))}
                </div>
             </div>
          )}
          {tab === 'holders' && (
             <div className="rdm-leaderboard-section">
                <div className="rdm-lb-header"><span>Address</span><span>Holdings</span></div>
                <div className="rdm-lb-list">
                   {loadingPart && <div className="rdm-lb-empty">Loading holders...</div>}
                   {!loadingPart && participants.length === 0 && <div className="rdm-lb-empty">No tickets sold yet.</div>}
                   {!loadingPart && participants.map((p, i) => (
                      <div key={i} className="rdm-lb-row">
                         <span className="rdm-lb-addr"><ExplorerLink addr={p.buyer} /></span>
                         <div className="rdm-lb-stats"><span className="rdm-lb-count">{p.ticketsPurchased} 🎟</span><span className="rdm-lb-pct">({p.percentage}%)</span></div>
                      </div>
                   ))}
                </div>
             </div>
          )}
        </div>

      </div>
    </div>
  );
}
