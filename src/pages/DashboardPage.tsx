// src/pages/DashboardPage.tsx
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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

function norm(a?: string | null) {
  return String(a || "").toLowerCase();
}

function shortAddr(a?: string | null, head = 6, tail = 4) {
  const s = String(a || "");
  if (!s) return "";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

const ACTIVE_STATUSES = ["OPEN", "FUNDING_PENDING", "DRAWING"] as const;

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

function normId(v: string): string {
  const s = String(v || "").toLowerCase();
  if (!s) return s;
  return s.startsWith("0x") ? s : `0x${s}`;
}

/**
 * Fetch "ticketsPurchased" (historical total bought) for the current buyer
 * across multiple raffles, via subgraph raffleParticipants.
 *
 * This fixes the UX issue:
 * - ticketsOwned() becomes 0 after refund
 * - but we still want to show the user bought N tickets in the past.
 */
async function fetchTicketsPurchasedByRaffle(
  raffleIds: string[],
  buyer: string,
  signal?: AbortSignal
): Promise<Map<string, number>> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const ids = Array.from(new Set(raffleIds.map((x) => normId(x)))).filter(Boolean);
  const out = new Map<string, number>();
  if (!ids.length || !buyer) return out;

  // Chunk for safety
  const chunkSize = 150;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);

    const query = `
      query MyTicketsPurchased($buyer: Bytes!, $ids: [Bytes!]!) {
        raffleParticipants(
          first: 1000
          where: { buyer: $buyer, raffle_in: $ids }
        ) {
          raffle { id }
          ticketsPurchased
        }
      }
    `;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { buyer: buyer.toLowerCase(), ids: chunk.map((x) => x.toLowerCase()) },
      }),
      signal,
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // subgraph sometimes returns non-json on 429/5xx
      continue;
    }
    if (!res.ok || json?.errors?.length) continue;

    const rows = (json?.data?.raffleParticipants ?? []) as any[];
    for (const r of rows) {
      const id = normId(r?.raffle?.id || "");
      const n = Number(r?.ticketsPurchased || 0);
      if (!id) continue;
      // Keep the max (should be single row anyway, but safe)
      out.set(id, Math.max(out.get(id) ?? 0, Number.isFinite(n) ? n : 0));
    }
  }

  return out;
}

function TicketPile({
  count,
  label,
}: {
  count: number;
  label?: string;
}) {
  if (!count || count <= 0) return null;

  const layers = Math.min(4, count);
  const badgeText = `x${count}`;

  return (
    <div
      title={label ? `${label}: ${count}` : `${count} tickets`}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "relative", width: 34, height: 28 }}>
        {Array.from({ length: layers }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.10)",
              background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
              boxShadow: "0 10px 20px rgba(15, 23, 42, 0.14)",
              transform: `translate(${i * 2}px, ${-i * 2}px)`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          padding: "4px 8px",
          borderRadius: 999,
          background: "#0f172a",
          color: "white",
          boxShadow: "0 12px 20px rgba(0,0,0,0.20)",
          letterSpacing: 0.2,
          whiteSpace: "nowrap",
        }}
      >
        {badgeText}
      </div>
    </div>
  );
}

export function DashboardPage({ account: accountProp, onOpenRaffle, onOpenSafety }: Props) {
  useEffect(() => {
    document.title = "Ppopgi 뽑기 — Dashboard";
  }, []);

  const { data, actions, account: hookAccount } = useDashboardController();

  // ✅ Source of truth: hook account (fallback to prop)
  const account = hookAccount ?? accountProp;

  // ✅ renamed "history" -> "joined" for clarity
  const [tab, setTab] = useState<"active" | "joined" | "created">("active");
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
  const { active: activeJoined, past: pastJoined } = useMemo(() => {
    const active: any[] = [];
    const past: any[] = [];

    if (!data.joined) return { active, past };

    data.joined.forEach((r: any) => {
      const tickets = Number(r.userTicketsOwned || 0);
      const sold = Math.max(0, Number(r.sold || 0));
      const percentage = sold > 0 ? ((tickets / sold) * 100).toFixed(1) : "0.0";

      const enriched = { ...r, userEntry: { count: tickets, percentage } };

      if (ACTIVE_STATUSES.includes(r.status)) active.push(enriched);
      else past.push(enriched);
    });

    return { active, past };
  }, [data.joined]);

  // --- CREATED RAFFLES (active only; past not needed right now) ---
  const activeCreated = useMemo(() => {
    const active: any[] = [];
    const arr = data.created ?? [];
    arr.forEach((r: any) => {
      if (ACTIVE_STATUSES.includes(r.status)) active.push(r);
    });
    return active;
  }, [data.created]);

  // ✅ On-going should include BOTH joined-active and created-active (dedup by id)
  const ongoingRaffles = useMemo(() => {
    const byId = new Map<string, any>();

    // keep joined version first so it preserves userEntry on cards where applicable
    for (const r of activeJoined) byId.set(String(r.id), r);
    for (const r of activeCreated) {
      const id = String(r.id);
      if (!byId.has(id)) byId.set(id, r);
    }

    return Array.from(byId.values());
  }, [activeJoined, activeCreated]);

  const createdCount = data.created?.length ?? 0;

  const msgIsSuccess = useMemo(() => {
    if (!data.msg) return false;
    return /success|successful|claimed/i.test(data.msg);
  }, [data.msg]);

  // ✅ Refunds: always claimTicketRefund (two-phase refund logic)
  const getPrimaryMethod = (opts: { isRefund: boolean; hasUsdc: boolean; hasNative: boolean; ticketCount: number }): WithdrawMethod | null => {
    const { isRefund, hasUsdc, hasNative, ticketCount } = opts;

    if (isRefund) return ticketCount > 0 ? "claimTicketRefund" : null;
    if (hasUsdc) return "withdrawFunds";
    if (hasNative) return "withdrawNative";
    return null;
  };

  const hasClaims = data.claimables.length > 0;

  // ✅ silent refresh UX: only show skeletons on true cold load
  const showColdSkeletons = data.isColdLoading && ongoingRaffles.length === 0;

  // -------------------------------------------------------
  // ✅ FIX: keep "tickets bought" (historical) even after refund
  // We fetch ticketsPurchased from the subgraph for the current user.
  // Used ONLY for dashboard display (pile + past tab + refund copy).
  // -------------------------------------------------------
  const [purchasedByRaffle, setPurchasedByRaffle] = useState<Map<string, number>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const relevantRaffleIdsForPurchased = useMemo(() => {
    // only need it for the two tabs you mentioned:
    // - ongoing (joined/created merged)
    // - pastJoined (joined tab)
    const ids = [
      ...ongoingRaffles.map((r: any) => String(r.id)),
      ...pastJoined.map((r: any) => String(r.id)),
    ];
    return Array.from(new Set(ids.map((x) => normId(x))));
  }, [ongoingRaffles, pastJoined]);

  const loadPurchased = useCallback(async () => {
    if (!account) {
      setPurchasedByRaffle(new Map());
      return;
    }

    // abort any in-flight
    try {
      abortRef.current?.abort();
    } catch {}
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const map = await fetchTicketsPurchasedByRaffle(relevantRaffleIdsForPurchased, account, ac.signal);
      if (!ac.signal.aborted) setPurchasedByRaffle(map);
    } catch {
      // ignore; dashboard still works with owned counts
    }
  }, [account, relevantRaffleIdsForPurchased]);

  useEffect(() => {
    void loadPurchased();
    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, [loadPurchased]);

  const getPurchasedEver = (raffleId: string) => purchasedByRaffle.get(normId(raffleId)) ?? 0;

  return (
    <div className="db-container">
      {/* HERO */}
      <div className="db-hero">
        <div className="db-hero-content">
          <div className="db-avatar-circle">👤</div>
          <div>
            <div className="db-hero-label">Player Dashboard</div>

            {/* ✅ Short display on mobile, full copy on click */}
            <div className="db-hero-addr" onClick={handleCopy} title="Click to Copy">
              {account ? shortAddr(account, 8, 6) : "Not Connected"}
              {account && <span className="db-copy-icon">{copied ? "✅" : "📋"}</span>}
            </div>
          </div>
        </div>

        <div className="db-hero-stats">
          <div className="db-stat">
            <div className="db-stat-num">{ongoingRaffles.length}</div>
            <div className="db-stat-lbl">On-going</div>
          </div>

          <div className="db-stat">
            <div className="db-stat-num">{pastJoined.length}</div>
            <div className="db-stat-lbl">Joined</div>
          </div>

          <div className="db-stat">
            <div className="db-stat-num">{createdCount}</div>
            <div className="db-stat-lbl">Created</div>
          </div>

          {hasClaims && (
            <div className="db-stat highlight">
              <div className="db-stat-num">{data.claimables.length}</div>
              <div className="db-stat-lbl">To Claim</div>
            </div>
          )}
        </div>
      </div>

      {/* STATUS BANNER */}
      {data.msg && <div className={`db-msg-banner ${msgIsSuccess ? "success" : "error"}`}>{data.msg}</div>}

      {/* CLAIMABLES SECTION */}
      <div className="db-section claim-section">
        <div className="db-section-header">
          <div className="db-section-title">Claimables</div>
          {hasClaims && <span className="db-pill pulse">Action Required</span>}
        </div>

        {!hasClaims ? (
          <div className="db-empty-claims">
            <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
            <div>You’ve already claimed everything!</div>
          </div>
        ) : (
          <div className="db-grid">
            {data.claimables.map((it: any) => {
              const r = it.raffle;

              const acct = norm(account);
              const winner = norm(r.winner);
              const creator = norm(r.creator);

              const iAmWinner = !!acct && acct === winner;
              const iAmCreator = !!acct && acct === creator;

              const hasUsdc = BigInt(it.claimableUsdc || "0") > 0n;
              const hasNative = BigInt(it.claimableNative || "0") > 0n;

              const isRefund = it.type === "REFUND";

              // IMPORTANT:
              // - userTicketsOwned may become 0 after refund claim
              // - purchasedEver remains from subgraph participant aggregation
              const ownedNow = Number(it.userTicketsOwned || 0);
              const purchasedEver = getPurchasedEver(r.id);
              const displayTicketCount = ownedNow > 0 ? ownedNow : purchasedEver;

              const primaryMethod = getPrimaryMethod({
                isRefund,
                hasUsdc,
                hasNative,
                ticketCount: displayTicketCount,
              });

              let badgeTitle = "Claim Available";
              let message = "Funds available to claim.";
              let primaryLabel = "Claim";

              if (isRefund) {
                badgeTitle = "Refund";
                message =
                  displayTicketCount > 0
                    ? `This raffle was canceled — reclaim the cost of ${displayTicketCount} ticket${displayTicketCount !== 1 ? "s" : ""}.`
                    : "This raffle was canceled — reclaim your ticket cost (if you participated).";
                primaryLabel = "Reclaim Refund";
              } else if (iAmWinner) {
                badgeTitle = "Winner";
                message = "You won 🎉 Claim your prize now.";
                primaryLabel = "Claim Prize";
              } else if (iAmCreator) {
                badgeTitle = "Creator";
                message = "Ticket sales are settled — withdraw your creator revenue.";
                primaryLabel = "Withdraw Revenue";
              } else {
                badgeTitle = "Claim";
                message = "Funds are available to withdraw.";
                primaryLabel = hasUsdc ? "Claim USDC" : hasNative ? "Claim Native" : "Claim";
              }

              const showDual = !isRefund && hasUsdc && hasNative;

              return (
                <div key={r.id} className="db-claim-wrapper" style={{ position: "relative" }}>
                  {/* Ticket pile overlay only on dashboard */}
                  <TicketPile count={displayTicketCount} label={isRefund ? "Tickets bought" : "Tickets"} />

                  <RaffleCard raffle={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} nowMs={nowS * 1000} />

                  <div className="db-claim-box">
                    <div className="db-claim-header">
                      <span className={`db-claim-badge ${isRefund ? "refund" : "win"}`}>{badgeTitle}</span>
                    </div>

                    <div className="db-claim-text">
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: "#334155" }}>{message}</div>

                      {isRefund ? (
                        <div className="db-refund-layout">
                          <div className="db-refund-val">
                            {displayTicketCount > 0 ? (
                              <>
                                Reclaim {displayTicketCount} ticket{displayTicketCount !== 1 ? "s" : ""}
                              </>
                            ) : (
                              <>Reclaim your refund</>
                            )}
                          </div>
                          {hasUsdc && (
                            <div className="db-refund-sub">
                              Expected: <b>{fmt(it.claimableUsdc, 6)} USDC</b>
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
                          <button className="db-btn primary" disabled={data.isPending} onClick={() => actions.withdraw(r.id, "withdrawFunds")}>
                            {data.isPending ? "Processing..." : "Claim USDC"}
                          </button>

                          <button className="db-btn secondary" disabled={data.isPending} onClick={() => actions.withdraw(r.id, "withdrawNative")}>
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
        )}
      </div>

      {/* MY RAFFLES TITLE */}
      <div className="db-section-header">
        <div className="db-section-title">My Raffles</div>
      </div>

      {/* TABS */}
      <div className="db-tabs-container">
        <div className="db-tabs">
          <button className={`db-tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>
            On-going
          </button>

          <button className={`db-tab ${tab === "joined" ? "active" : ""}`} onClick={() => setTab("joined")}>
            Joined
          </button>

          <button className={`db-tab ${tab === "created" ? "active" : ""}`} onClick={() => setTab("created")}>
            Created <span style={{ opacity: 0.7 }}>({createdCount})</span>
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="db-grid-area">
        {tab === "active" && (
          <div className="db-grid">
            {showColdSkeletons && (
              <>
                <RaffleCardSkeleton />
                <RaffleCardSkeleton />
              </>
            )}

            {!data.isColdLoading && ongoingRaffles.length === 0 && (
              <div className="db-empty">You have no on-going raffles (joined or created).</div>
            )}

            {ongoingRaffles.map((r: any) => {
              const ownedNow = Number(r.userEntry?.count ?? 0);
              const purchasedEver = getPurchasedEver(r.id);
              const displayCount = ownedNow > 0 ? ownedNow : purchasedEver;

              return (
                <div key={r.id} style={{ position: "relative" }}>
                  {/* Ticket pile overlay only on dashboard */}
                  <TicketPile count={displayCount} label={ownedNow > 0 ? "Tickets owned" : "Tickets bought"} />

                  <RaffleCard
                    raffle={r}
                    onOpen={onOpenRaffle}
                    onOpenSafety={onOpenSafety}
                    nowMs={nowS * 1000}
                    userEntry={r.userEntry}
                  />
                </div>
              );
            })}
          </div>
        )}

        {tab === "joined" && (
          <div className="db-grid">
            {!data.isColdLoading && pastJoined.length === 0 && <div className="db-empty">No joined raffles history found.</div>}

            {pastJoined.map((r: any) => {
              const acct = norm(account);
              const winner = norm(r.winner);

              const ownedNow = Number(r.userEntry?.count ?? 0);
              const purchasedEver = getPurchasedEver(r.id);
              const displayCount = ownedNow > 0 ? ownedNow : purchasedEver;

              const participated = (purchasedEver > 0) || (ownedNow > 0);
              const completed = r.status === "COMPLETED";
              const canceled = r.status === "CANCELED";
              const iWon = completed && acct && winner === acct;

              // UI badge: refunded if canceled and currently owned is 0 but historically bought > 0
              const isRefunded = canceled && ownedNow === 0 && purchasedEver > 0;

              const iLost = completed && participated && !iWon;

              return (
                <div key={r.id} className="db-history-card-wrapper" style={{ position: "relative" }}>
                  {/* Ticket pile overlay only on dashboard */}
                  <TicketPile count={displayCount} label={ownedNow > 0 ? "Tickets owned" : "Tickets bought"} />

                  <RaffleCard
                    raffle={r}
                    onOpen={onOpenRaffle}
                    onOpenSafety={onOpenSafety}
                    nowMs={nowS * 1000}
                    userEntry={r.userEntry}
                  />

                  {isRefunded && <div className="db-history-badge refunded">↩ Refunded (bought {purchasedEver})</div>}
                  {iWon && <div className="db-history-badge won">🏆 Winner</div>}
                  {iLost && <div className="db-history-badge lost">Lost - Better luck next time!</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "created" && (
          <div className="db-grid">
            {!data.isColdLoading && data.created.length === 0 && <div className="db-empty">You haven't hosted any raffles yet.</div>}

            {data.created.map((r: any) => (
              <RaffleCard key={r.id} raffle={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} nowMs={nowS * 1000} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}