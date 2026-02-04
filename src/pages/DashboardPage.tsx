// src/pages/DashboardPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import { formatUnits } from "ethers";
import { RaffleCard } from "../components/RaffleCard";
import { RaffleCardSkeleton } from "../components/RaffleCardSkeleton"; 
import { useDashboardController } from "../hooks/useDashboardController";
import "./DashboardPage.css";

// Helpers
const fmt = (v: string, dec = 18) => { try { return formatUnits(BigInt(v || "0"), dec); } catch { return "0"; } };
const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
};

type Props = {
  account: string | null;
  onOpenRaffle: (id: string) => void;
  onOpenSafety: (id: string) => void;
};

export function DashboardPage({ account, onOpenRaffle, onOpenSafety }: Props) {
  const { data, hatch, actions } = useDashboardController();
  const [tab, setTab] = useState<"active" | "history" | "created">("active");
  
  // Clock
  const [nowS, setNowS] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => { const t = setInterval(() => setNowS(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, []);

  // --- DATA PROCESSING ---
  // ✅ FIX: Correctly destructured aliases { active: activeEntries, past: pastEntries }
  const { active: activeEntries, past: pastEntries } = useMemo(() => {
    const active: any[] = [];
    const past: any[] = [];
    
    if (!data.joined) return { active, past };

    data.joined.forEach((item: any) => {
      // Handle if item is { raffle: ..., ticketsPurchased: ... } or just raffle
      const r = item.raffle || item; 
      const userCount = Number(item.ticketsPurchased || 0);
      const sold = Number(r.sold || 1);
      const percentage = userCount > 0 ? ((userCount / sold) * 100).toFixed(1) : "0.0";
      
      const enriched = { ...r, userEntry: { count: userCount, percentage } };

      if (r.status === "OPEN" || r.status === "FUNDING_PENDING" || r.status === "DRAWING") {
        active.push(enriched);
      } else {
        past.push(enriched);
      }
    });

    return { active, past };
  }, [data.joined]);


  // --- HATCH LOGIC ---
  const getHatchProps = (raffleId: string, creator: string) => {
    if (!account || creator?.toLowerCase() !== account.toLowerCase()) return null;
    const drawAt = Number(hatch.timestamps[raffleId] || "0");
    if (drawAt <= 0) return null; 

    const unlockAt = drawAt + 86400; // 24h delay
    const secLeft = unlockAt - nowS;
    const ready = secLeft <= 0;

    return {
      show: true,
      label: ready ? "Hatch Ready" : `Hatch in ${fmtTime(secLeft)}`,
      disabled: !ready || hatch.busy[raffleId] || data.isPending,
      onClick: () => hatch.trigger(raffleId),
    };
  };

  return (
    <div className="db-container">
      
      {/* 1. PLAYER HERO */}
      <div className="db-hero">
         <div className="db-hero-content">
            <div className="db-avatar-circle">👤</div>
            <div>
               <div className="db-hero-label">Player Dashboard</div>
               <div className="db-hero-addr">{account ? account : "Not Connected"}</div>
            </div>
         </div>
         <div className="db-hero-stats">
            <div className="db-stat">
               <div className="db-stat-num">{activeEntries.length}</div>
               <div className="db-stat-lbl">Active Entries</div>
            </div>
            <div className="db-stat">
               <div className="db-stat-num">{pastEntries.length}</div>
               <div className="db-stat-lbl">Completed</div>
            </div>
            {data.claimables?.length > 0 && (
               <div className="db-stat highlight">
                  <div className="db-stat-num">{data.claimables.length}</div>
                  <div className="db-stat-lbl">To Claim</div>
               </div>
            )}
         </div>
      </div>

      {/* 2. CLAIMABLES (Priority) */}
      {data.claimables?.length > 0 && (
        <div className="db-section claim-section">
           <div className="db-section-header">
              <div className="db-section-title">💰 Winnings & Refunds</div>
              <span className="db-pill pulse">Action Required</span>
           </div>
           
           <div className="db-grid">
             {data.claimables.map((it: any) => {
                const r = it.raffle;
                const hasUsdc = BigInt(it.claimableUsdc || 0) > 0n;
                const hasNative = BigInt(it.claimableNative || 0) > 0n;
                
                return (
                  <div key={r.id} className="db-claim-wrapper">
                     <RaffleCard raffle={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} nowMs={nowS * 1000} />
                     <div className="db-claim-box">
                        <div className="db-claim-text">
                           Available: {fmt(it.claimableUsdc, 6)} USDC {hasNative && `+ ${fmt(it.claimableNative, 18)} ETH`}
                        </div>
                        <div className="db-claim-actions">
                           <button className="db-btn" disabled={!hasUsdc || data.isPending} onClick={() => actions.withdraw(r.id, "withdrawFunds")}>
                              Claim Prize
                           </button>
                           {/* Logic for refunds if needed */}
                        </div>
                     </div>
                  </div>
                );
             })}
           </div>
        </div>
      )}

      {/* 3. TABS */}
      <div className="db-tabs">
         <button className={`db-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Active Entries</button>
         <button className={`db-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
         <button className={`db-tab ${tab === 'created' ? 'active' : ''}`} onClick={() => setTab('created')}>Created</button>
         <div style={{flex:1}} />
         <button className="db-refresh-btn" onClick={actions.refresh} disabled={data.isPending}>🔄</button>
      </div>

      {/* 4. CONTENT GRID */}
      <div className="db-grid-area">
         
         {/* ACTIVE */}
         {tab === 'active' && (
            <div className="db-grid">
               {data.isPending && activeEntries.length === 0 && <><RaffleCardSkeleton /><RaffleCardSkeleton /></>}
               {!data.isPending && activeEntries.length === 0 && <div className="db-empty">You have no active tickets. Good luck next time!</div>}
               {activeEntries.map((r: any) => (
                  <RaffleCard 
                     key={r.id} 
                     raffle={r} 
                     onOpen={onOpenRaffle} 
                     onOpenSafety={onOpenSafety}
                     nowMs={nowS * 1000}
                     userEntry={r.userEntry}
                  />
               ))}
            </div>
         )}

         {/* HISTORY */}
         {tab === 'history' && (
            <div className="db-grid">
               {!data.isPending && pastEntries.length === 0 && <div className="db-empty">No past participation found.</div>}
               {pastEntries.map((r: any) => (
                  <RaffleCard 
                     key={r.id} 
                     raffle={r} 
                     onOpen={onOpenRaffle} 
                     onOpenSafety={onOpenSafety}
                     nowMs={nowS * 1000}
                     userEntry={r.userEntry}
                  />
               ))}
            </div>
         )}

         {/* CREATED */}
         {tab === 'created' && (
            <div className="db-grid">
               {!data.isPending && data.created?.length === 0 && <div className="db-empty">You haven't hosted any raffles yet.</div>}
               {data.created?.map((r: any) => (
                  <RaffleCard 
                     key={r.id} 
                     raffle={r} 
                     onOpen={onOpenRaffle} 
                     onOpenSafety={onOpenSafety}
                     nowMs={nowS * 1000}
                     hatch={getHatchProps(r.id, r.creator)}
                  />
               ))}
            </div>
         )}

      </div>
    </div>
  );
}
