// src/pages/DashboardPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import { formatUnits } from "ethers";
import { RaffleCard } from "../components/RaffleCard";
import { RaffleCardSkeleton } from "../components/RaffleCardSkeleton"; 
import { useDashboardController } from "../hooks/useDashboardController";
import "./DashboardPage.css";

// Helpers
const fmt = (v: string, dec = 18) => { 
  try { 
    const val = formatUnits(BigInt(v || "0"), dec);
    return parseFloat(val).toLocaleString("en-US", { maximumFractionDigits: 2 }); 
  } catch { return "0"; } 
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (s: number) => {
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = Math.floor(s % 60);
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
};

type Props = {
  account: string | null;
  onOpenRaffle: (id: string) => void;
  onOpenSafety: (id: string) => void;
};

export function DashboardPage({ account, onOpenRaffle, onOpenSafety }: Props) {
  const { data, actions } = useDashboardController(); 
  const [tab, setTab] = useState<"active" | "history" | "created">("active");
  const [copied, setCopied] = useState(false);
  
  // Clock
  const [nowS, setNowS] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNowS(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const handleCopy = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- DATA PROCESSING ---
  const { active: activeEntries, past: pastEntries } = useMemo(() => {
    const active: any[] = [];
    const past: any[] = [];
    
    if (!data.joined) return { active, past };

    data.joined.forEach((item: any) => {
      const r = item; 
      const userCount = Number(item.userTicketsOwned || 0);
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

  return (
    <div className="db-container">
      
      {/* HERO */}
      <div className="db-hero">
        <div className="db-hero-content">
          <div className="db-avatar-circle">👤</div>
          <div>
            <div className="db-hero-label">Player Dashboard</div>
            <div className="db-hero-addr" onClick={handleCopy}>
              {account || "Not Connected"}
              {account && <span className="db-copy-icon">{copied ? "✅" : "📋"}</span>}
            </div>
          </div>
        </div>

        <div className="db-hero-stats">
          <div className="db-stat">
            <div className="db-stat-num">{activeEntries.length}</div>
            <div className="db-stat-lbl">Active Entries</div>
          </div>
          <div className="db-stat">
            <div className="db-stat-num">{pastEntries.length}</div>
            <div className="db-stat-lbl">History</div>
          </div>
          {data.claimables?.length > 0 && (
            <div className="db-stat highlight">
              <div className="db-stat-num">{data.claimables.length}</div>
              <div className="db-stat-lbl">To Claim</div>
            </div>
          )}
        </div>
      </div>

      {/* CLAIMABLES */}
      {data.claimables?.length > 0 && (
        <div className="db-section claim-section">
          <div className="db-section-header">
            <div className="db-section-title">💰 Winnings & Refunds</div>
            <span className="db-pill pulse">Action Required</span>
          </div>

          <div className="db-grid">
            {data.claimables.map((it: any) => {
              const r = it.raffle;

              const hasUsdc = BigInt(it.claimableUsdc || "0") > 0n;
              const hasNative = BigInt(it.claimableNative || "0") > 0n;

              const isRefund = it.type === "REFUND";
              const ticketCount = Number(it.userTicketsOwned || 0);

              // ✅ FIX: choose method by ROLE, not just status
              const method =
                isRefund && it.roles?.participated
                  ? "claimTicketRefund"
                  : "withdrawFunds";

              const label = isRefund ? "Reclaim Funds" : "Claim Prize";
              const title = isRefund ? "Refund Available" : "Winner!";

              return (
                <div key={r.id} className="db-claim-wrapper">
                  <RaffleCard
                    raffle={r}
                    onOpen={onOpenRaffle}
                    onOpenSafety={onOpenSafety}
                    nowMs={nowS * 1000}
                  />

                  <div className="db-claim-box">
                    <div className="db-claim-header">
                      <span className={`db-claim-badge ${isRefund ? "refund" : "win"}`}>
                        {title}
                      </span>
                    </div>

                    <div className="db-claim-text">
                      {isRefund ? (
                        <div className="db-refund-layout">
                          {hasUsdc ? (
                            <>
                              <div className="db-refund-val">
                                {fmt(it.claimableUsdc, 6)} USDC
                              </div>
                              <div className="db-refund-sub">
                                Refund for <b>{ticketCount}</b> ticket{ticketCount !== 1 ? "s" : ""}
                              </div>
                            </>
                          ) : (
                            <div className="db-refund-val" style={{ fontSize: 18 }}>
                              Reclaim {ticketCount || "your"} ticket{ticketCount !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="db-win-layout">
                          <div className="db-win-label">Prize Amount:</div>
                          <div className="db-win-val">
                            {hasUsdc && <span>{fmt(it.claimableUsdc, 6)} USDC</span>}
                            {hasNative && <span> + {fmt(it.claimableNative, 18)} ETH</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="db-claim-actions">
                      <button
                        className={`db-btn ${isRefund ? "secondary" : "primary"}`}
                        disabled={data.isPending}
                        onClick={() => actions.withdraw(r.id, method)}
                      >
                        {data.isPending ? "Processing..." : label}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs + rest of page unchanged */}
    </div>
  );
}