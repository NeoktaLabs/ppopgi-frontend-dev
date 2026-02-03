// src/pages/DashboardPageV2.tsx
import React, { useState, useEffect } from "react";
import { formatUnits } from "ethers";
import { RaffleCard } from "../components/RaffleCard";
import { RaffleCardSkeleton } from "../components/RaffleCardSkeleton"; // ✅ Import
import { useDashboardController } from "../hooks/useDashboardController";
import "./DashboardPage.css";

// --- Helpers ---
const fmt = (v: string, dec = 18) => { try { return formatUnits(BigInt(v || "0"), dec); } catch { return "0"; } };
const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
};

type Props = {
  account: string | null;
  onOpenRaffle: (id: string) => void;
  onOpenSafety: (id: string) => void;
};

export function DashboardPage({ account, onOpenRaffle, onOpenSafety }: Props) {
  const { data, hatch, actions } = useDashboardController();
  
  // Local clock for UI countdowns
  const [nowS, setNowS] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => { const t = setInterval(() => setNowS(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, []);

  // View Logic: Hatch Button State
  const getHatchProps = (raffleId: string, creator: string) => {
    if (!account || creator.toLowerCase() !== account.toLowerCase()) return null;
    const drawAt = Number(hatch.timestamps[raffleId] || "0");
    if (drawAt <= 0) return null; // Not loaded or not ready

    const unlockAt = drawAt + 86400; // 24 hours
    const secLeft = unlockAt - nowS;
    const ready = secLeft <= 0;

    return {
      show: true,
      label: ready ? "Hatch Ready" : `Hatch in ${fmtTime(secLeft)}`,
      disabled: !ready || hatch.busy[raffleId] || data.isPending,
      onClick: () => hatch.trigger(raffleId),
      note: hatch.notes[raffleId]
    };
  };

  return (
    <div className="db-container">
      {/* Header */}
      <div className="db-header">
        <h2>Dashboard</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
           <span style={{ fontSize: 12, opacity: 0.8 }}>{account ? "Your Activity" : "Sign in required"}</span>
           <button className="db-pill" onClick={actions.refresh} disabled={data.isPending}>Refresh</button>
        </div>
      </div>

      {data.msg && <div className="db-claim-text" style={{ marginBottom: 10, color: "#D32F2F" }}>{data.msg}</div>}

      {/* 1. Created Raffles */}
      <div className="db-section">
        <div className="db-section-title">Created by you</div>
        <div className="db-grid">
           {/* Loading State */}
           {data.isPending && data.created?.length === 0 && (
             <>
               <RaffleCardSkeleton /><RaffleCardSkeleton /><RaffleCardSkeleton />
             </>
           )}

           {!data.isPending && data.created?.length === 0 && <span style={{ opacity: 0.6, fontSize: 13 }}>No raffles created.</span>}
           
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
      </div>

      {/* 2. Joined Raffles */}
      <div className="db-section">
        <div className="db-section-title">Joined</div>
        <div className="db-grid">
           {/* Loading State */}
           {data.isPending && data.joined?.length === 0 && (
             <><RaffleCardSkeleton /><RaffleCardSkeleton /></>
           )}

           {!data.isPending && data.joined?.length === 0 && <span style={{ opacity: 0.6, fontSize: 13 }}>No raffles joined.</span>}
           
           {data.joined?.map((r: any) => (
             <RaffleCard 
               key={r.id} 
               raffle={r} 
               onOpen={onOpenRaffle} 
               onOpenSafety={onOpenSafety}
               nowMs={nowS * 1000} 
             />
           ))}
        </div>
      </div>

      {/* 3. Claimables */}
      <div className="db-section">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div className="db-section-title">Claimables</div>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{data.claimables?.length || 0} items</span>
        </div>
        
        <div className="db-grid">
          {!data.isPending && data.claimables?.length === 0 && <span style={{ opacity: 0.6, fontSize: 13 }}>Nothing to claim.</span>}
          
          {data.claimables?.map((it: any) => {
             const r = it.raffle;
             const hasUsdc = BigInt(it.claimableUsdc || 0) > 0n;
             const hasNative = BigInt(it.claimableNative || 0) > 0n;
             
             return (
               <div key={r.id} className="db-claim-wrapper">
                  <RaffleCard 
                    raffle={r} 
                    onOpen={onOpenRaffle} 
                    onOpenSafety={onOpenSafety}
                    nowMs={nowS * 1000} 
                  />
                  <div className="db-claim-box">
                     <div className="db-claim-text">
                        Claimable: {fmt(it.claimableUsdc, 6)} USDC • {fmt(it.claimableNative, 18)} Native
                     </div>
                     <div className="db-claim-actions">
                        <button className="db-btn" disabled={!hasUsdc || data.isPending} onClick={() => actions.withdraw(r.id, "withdrawFunds")}>
                           Withdraw USDC
                        </button>
                        <button className="db-btn" disabled={!hasNative || data.isPending} onClick={() => actions.withdraw(r.id, "withdrawNative")}>
                           Withdraw Native
                        </button>
                     </div>
                     {it.roles?.participated && (
                        <button className="db-btn" style={{ width: "100%" }} disabled={data.isPending} onClick={() => actions.withdraw(r.id, "claimTicketRefund")}>
                           Check Ticket Refund
                        </button>
                     )}
                  </div>
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}
