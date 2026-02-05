// src/pages/DashboardPage.tsx
import { useState, useEffect, useMemo } from "react";
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
  } catch {
    return "0";
  }
};

type Props = {
  account: string | null;
  onOpenRaffle: (id: string) => void;
  onOpenSafety: (id: string) => void;
};

type WithdrawMethod = "withdrawFunds" | "withdrawNative" | "claimTicketRefund";

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
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- JOINED RAFFLES PROCESSING ---
  const { active: activeEntries, past: pastEntries } = useMemo(() => {
    const active: any[] = [];
    const past: any[] = [];

    if (!data.joined) return { active, past };

    data.joined.forEach((r: any) => {
      const tickets = Number(r.userTicketsOwned || 0);
      const sold = Number(r.sold || 1);
      const percentage = tickets > 0 ? ((tickets / sold) * 100).toFixed(1) : "0.0";

      const enriched = { ...r, userEntry: { count: tickets, percentage } };

      if (["OPEN", "FUNDING_PENDING", "DRAWING"].includes(r.status)) {
        active.push(enriched);
      } else {
        past.push(enriched);
      }
    });

    return { active, past };
  }, [data.joined]);

  const msgIsSuccess = useMemo(() => {
    if (!data.msg) return false;
    return /success|successful|claimed/i.test(data.msg);
  }, [data.msg]);

  // Decide which primary withdraw method to use.
  // Refund is TWO-PHASE:
  //  - If claimableUsdc > 0 => user already allocated, so withdrawFunds transfers
  //  - Else if ticketsOwned > 0 => claimTicketRefund allocates
  const getPrimaryMethod = (opts: {
    isRefund: boolean;
    hasUsdc: boolean;
    hasNative: boolean;
    ticketCount: number;
  }): WithdrawMethod | null => {
    const { isRefund, hasUsdc, hasNative, ticketCount } = opts;

    if (isRefund) {
      if (hasUsdc) return "withdrawFunds"; // money already allocated
      if (ticketCount > 0) return "claimTicketRefund"; // allocate refund
      return null;
    }

    if (hasUsdc) return "withdrawFunds";
    if (hasNative) return "withdrawNative";
    return null;
  };

  return (
    <div className="db-container">
      {/* HERO */}
      <div className="db-hero">
        <div className="db-hero-content">
          <div className="db-avatar-circle">👤</div>
          <div>
            <div className="db-hero-label">Player Dashboard</div>
            <div className="db-hero-addr" onClick={handleCopy} title="Click to Copy">
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
          {data.claimables.length > 0 && (
            <div className="db-stat highlight">
              <div className="db-stat-num">{data.claimables.length}</div>
              <div className="db-stat-lbl">To Claim</div>
            </div>
          )}
        </div>
      </div>

      {/* STATUS BANNER */}
      {data.msg && (
        <div className={`db-msg-banner ${msgIsSuccess ? "success" : "error"}`}>
          {data.msg}
        </div>
      )}

      {/* CLAIMABLES */}
      {data.claimables.length > 0 && (
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

              // ✅ IMPORTANT: refund UX only when the controller labeled it REFUND
              const isRefund = it.type === "REFUND";
              const ticketCount = Number(it.userTicketsOwned || 0);

              const primaryMethod = getPrimaryMethod({
                isRefund,
                hasUsdc,
                hasNative,
                ticketCount,
              });

              const title = isRefund ? "Refund Available" : "Claim Available";

              const primaryLabel = (() => {
                if (!primaryMethod) return "Nothing to Claim";

                if (isRefund) {
                  if (primaryMethod === "withdrawFunds") return "Claim USDC";
                  return "Reclaim Refund";
                }

                if (primaryMethod === "withdrawFunds") return "Claim USDC";
                if (primaryMethod === "withdrawNative") return "Claim Native";
                return "Claim";
              })();

              // Dual-asset claim only makes sense for non-refund claims
              const showDual = !isRefund && hasUsdc && hasNative;

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
                              <div className="db-refund-val">{fmt(it.claimableUsdc, 6)} USDC</div>
                              <div className="db-refund-sub">
                                Refund {ticketCount > 0 ? <>for <b>{ticketCount}</b> ticket{ticketCount !== 1 ? "s" : ""}</> : null}
                              </div>
                            </>
                          ) : (
                            <div className="db-refund-val">
                              Reclaim {ticketCount || "your"} ticket{ticketCount !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="db-win-layout">
                          <div className="db-win-label">Available:</div>
                          <div className="db-win-val">
                            {hasUsdc && <span>{fmt(it.claimableUsdc, 6)} USDC</span>}
                            {hasNative && (
                              <span>
                                {hasUsdc ? " + " : ""}
                                {fmt(it.claimableNative, 18)} Native
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="db-claim-actions">
                      {showDual ? (
                        <>
                          <button
                            className="db-btn primary"
                            disabled={data.isPending}
                            onClick={() => actions.withdraw(r.id, "withdrawFunds")}
                          >
                            {data.isPending ? "Processing..." : "Claim USDC"}
                          </button>

                          <button
                            className="db-btn secondary"
                            disabled={data.isPending}
                            onClick={() => actions.withdraw(r.id, "withdrawNative")}
                          >
                            {data.isPending ? "Processing..." : "Claim Native"}
                          </button>
                        </>
                      ) : (
                        <button
                          className={`db-btn ${isRefund ? "secondary" : "primary"}`}
                          disabled={data.isPending || !primaryMethod}
                          onClick={() => primaryMethod && actions.withdraw(r.id, primaryMethod)}
                        >
                          {data.isPending ? "Processing..." : primaryLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="db-tabs-container">
        <div className="db-tabs">
          <button className={`db-tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>
            Active Entries
          </button>
          <button className={`db-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            History
          </button>
          <button className={`db-tab ${tab === "created" ? "active" : ""}`} onClick={() => setTab("created")}>
            Created
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="db-grid-area">
        {tab === "active" && (
          <div className="db-grid">
            {data.isPending && activeEntries.length === 0 && (
              <>
                <RaffleCardSkeleton />
                <RaffleCardSkeleton />
              </>
            )}
            {!data.isPending && activeEntries.length === 0 && (
              <div className="db-empty">You have no active tickets.</div>
            )}
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

        {tab === "history" && (
          <div className="db-grid">
            {!data.isPending && pastEntries.length === 0 && (
              <div className="db-empty">No past participation found.</div>
            )}
            {pastEntries.map((r: any) => {
              const isRefunded = r.status === "CANCELED" && r.userEntry?.count === 0;

              return (
                <div key={r.id} className="db-history-card-wrapper">
                  <RaffleCard
                    raffle={r}
                    onOpen={onOpenRaffle}
                    onOpenSafety={onOpenSafety}
                    nowMs={nowS * 1000}
                    userEntry={r.userEntry}
                  />
                  {isRefunded && <div className="db-history-badge refunded">↩ Ticket Refunded</div>}
                  {r.status === "COMPLETED" &&
                    r.winner?.toLowerCase() === account?.toLowerCase() && (
                      <div className="db-history-badge won">🏆 Winner</div>
                    )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "created" && (
          <div className="db-grid">
            {!data.isPending && data.created.length === 0 && (
              <div className="db-empty">You haven't hosted any raffles yet.</div>
            )}
            {data.created.map((r: any) => (
              <RaffleCard
                key={r.id}
                raffle={r}
                onOpen={onOpenRaffle}
                onOpenSafety={onOpenSafety}
                nowMs={nowS * 1000}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}