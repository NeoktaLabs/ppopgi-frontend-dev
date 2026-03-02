// src/components/LotteryCard.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { LotteryListItem } from "../indexer/subgraph"; // ✅ updated type
import { useLotteryCard } from "../hooks/useLotteryCard";
import { useLotteryInteraction } from "../hooks/useLotteryInteraction";
import "./LotteryCard.css";

// ✅ shared UI formatter (removes trailing .0 by default)
import { fmtUsdcUi } from "../lib/format";

const EXPLORER_URL = "https://explorer.etherlink.com/address/";
const EXPLORER_TX_URL = "https://explorer.etherlink.com/tx/";

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

type FinalizerInfo = {
  running: boolean;
  secondsToNextRun: number | null;
  tsMs: number;
};

type Props = {
  lottery: LotteryListItem;
  onOpen: (id: string) => void;
  onOpenSafety?: (id: string) => void;
  ribbon?: "gold" | "silver" | "bronze";
  nowMs?: number;
  hatch?: HatchUI | null;
  userEntry?: UserEntryStats;
  finalizer?: FinalizerInfo | null;

  /**
   * ✅ gate quick buy behind sign-in (same behavior as before)
   * - If isSignedIn === false, clicking Buy Ticket will open sign-in instead of expanding.
   * - If you don't pass these props, behavior stays exactly the same as before.
   */
  isSignedIn?: boolean;
  onOpenSignIn?: () => void;
};

const short = (addr: string) => (addr ? `${addr.slice(0, 5)}...${addr.slice(-4)}` : "Unknown");

function clampPct(p: number) {
  if (!isFinite(p) || p <= 0) return "0%";
  if (p < 0.01) return "<0.01%";
  if (p >= 100) return "100%";
  return p < 1 ? `${p.toFixed(2)}%` : `${p.toFixed(1)}%`;
}

function fmtMinSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function clampTicketsUi(v: any) {
  const n = Math.floor(Number(String(v ?? "").trim()));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, n);
}

export function LotteryCard({
  lottery,
  onOpen,
  onOpenSafety,
  ribbon,
  nowMs = Date.now(),
  hatch,
  userEntry,
  finalizer,

  // ✅ NEW
  isSignedIn,
  onOpenSignIn,
}: Props) {
  const { ui, actions } = useLotteryCard(lottery, nowMs);

  // ✅ Quick-buy expand state (local)
  const [qbOpen, setQbOpen] = useState(false);

  // ✅ Quick-buy engine (same logic as the modal, but only “active” when expanded)
  const { state: qbState, math: qbMath, flags: qbFlags, actions: qbActions } = useLotteryInteraction(lottery.id, qbOpen);

  const statusRaw = String((lottery as any).status || "");
  const isOpenStatus = statusRaw === "OPEN";

  const maxTicketsN = Number((lottery as any).maxTickets ?? 0);
  const soldN = Number((lottery as any).sold ?? 0);
  const maxReached = maxTicketsN > 0 && soldN >= maxTicketsN;

  const deadlineSec = Number((lottery as any).deadline ?? 0);
  const deadlinePassed = deadlineSec > 0 && nowMs >= deadlineSec * 1000;

  const endConditionReached = isOpenStatus && (maxReached || deadlinePassed);

  const minTicketsN = Number((lottery as any).minTickets ?? 0);
  const hasMin = (ui as any)?.hasMin ?? minTicketsN > 0;
  const minReached = (ui as any)?.minReached ?? (hasMin ? soldN >= Math.max(0, minTicketsN) : true);

  type EndMode = "CANCELING" | "DRAWING";
  const endMode: EndMode | null = endConditionReached ? (minReached ? "DRAWING" : "CANCELING") : null;

  const endCountdownSec = useMemo(() => {
    const to = finalizer?.secondsToNextRun ?? null;
    if (to === null) return null;
    const sec = Math.max(0, Math.floor(to));
    return sec === 0 ? 0 : sec;
  }, [finalizer?.secondsToNextRun, finalizer?.tsMs]);

  const endChipNode = useMemo(() => {
    if (!endMode) return null;
    const title = endMode === "CANCELING" ? "Canceling" : "Drawing winner";
    if (finalizer?.running)
      return (
        <>
          {title}
          <br />
          ~ now
        </>
      );
    if (endCountdownSec === null)
      return (
        <>
          {title}
          <br />
          ~ soon
        </>
      );
    return (
      <>
        {title}
        <br />
        ~ {fmtMinSec(endCountdownSec)}
      </>
    );
  }, [endMode, finalizer?.running, endCountdownSec]);

  const displayStatus = endMode ? (endMode === "CANCELING" ? "Canceling" : "Drawing") : ui.displayStatus;
  const isLiveForCard = ui.isLive && !endConditionReached;
  const statusClass = displayStatus.toLowerCase().replace(" ", "-");
  const cardClass = `rc-card ${ribbon || ""}`;

  // Prefer creator (new data), keep owner fallback only if legacy rows exist
  const hostAddr = (lottery as any).creator || (lottery as any).owner;

  const winRateLabel = useMemo(() => {
    const max = Number((lottery as any).maxTickets ?? 0);
    const sold = Number((lottery as any).sold ?? 0);
    const denom = max > 0 ? max : sold + 1;
    if (!isFinite(denom) || denom <= 0) return "0%";
    return clampPct((1 / denom) * 100);
  }, [lottery.maxTickets, lottery.sold]);

  const endInfoBlock = useMemo(() => {
    if (!endMode) return null;
    if (endMode === "CANCELING") {
      return (
        <div className="rc-end-note">
          <div style={{ marginBottom: 6 }}>Canceling lottery</div>
          <div className="rc-end-sub">
            Min tickets not reached.
            <br />
            Reclaim available soon on your dashboard.
          </div>
        </div>
      );
    }
    const reason = maxReached ? "Sold Out" : "Time's Up";
    return (
      <div className="rc-end-note">
        <div style={{ marginBottom: 6 }}>Drawing Winner ({reason})</div>
        <div className="rc-end-sub">
          Selection pending...
          <br />
          Check back soon.
        </div>
      </div>
    );
  }, [endMode, maxReached]);

  // Fix TS: title prop cannot be null
  const titleText = lottery.name ?? undefined;
  const displayName = lottery.name ?? "Lottery";

  // Card display numbers (no decimals)
  const potUi = useMemo(() => fmtUsdcUi(ui.formattedPot, { maxDecimals: 0 }), [ui.formattedPot]);
  const priceUi = useMemo(() => fmtUsdcUi(ui.formattedPrice, { maxDecimals: 0 }), [ui.formattedPrice]);

  // -------- Quick buy derived UI --------
  const showSuccess = qbOpen && !!qbState.lastBuy;

  // Gate blur behind the prop (so behavior matches your requested gating),
  // but fall back to wallet connection if the prop isn't provided.
  const shouldGate = isSignedIn === false || (!isSignedIn && !qbState.isConnected);
  const blurBuy = qbOpen && shouldGate;

  const ticketPriceU = useMemo(() => {
    try {
      return BigInt((lottery as any)?.ticketPrice || "0");
    } catch {
      return 0n;
    }
  }, [lottery]);

  const affordableMaxBuy = useMemo(() => {
    if (!qbState.usdcBal || ticketPriceU <= 0n) return Number.POSITIVE_INFINITY;
    const max = qbState.usdcBal / ticketPriceU;
    const capped = max > 10_000n ? 10_000 : Number(max);
    return Math.max(0, capped);
  }, [qbState.usdcBal, ticketPriceU]);

  const remainingCap = Math.max(0, Number(qbMath.maxBuy || 0));
  const effectiveMaxBuy = Number.isFinite(affordableMaxBuy) ? Math.max(0, Math.min(remainingCap, affordableMaxBuy)) : remainingCap;

  const uiMaxForStepper = Math.max(1, effectiveMaxBuy);
  const uiTicket = clampTicketsUi(qbState.tickets);
  const clampedUiTicket = Math.min(uiTicket, uiMaxForStepper);

  useEffect(() => {
    if (!qbOpen) return;
    if (String(clampedUiTicket) !== String(qbState.tickets)) qbActions.setTickets(String(clampedUiTicket));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qbOpen, uiMaxForStepper]);

  const balanceUi = useMemo(() => fmtUsdcUi(qbMath.fmtUsdc(qbState.usdcBal?.toString() || "0")), [qbMath, qbState.usdcBal]);
  const totalUi = useMemo(() => fmtUsdcUi(qbMath.fmtUsdc(qbMath.totalCostU.toString())), [qbMath, qbMath.totalCostU]);

  const soldEffective = useMemo(() => {
    const base = Number((lottery as any)?.sold || 0);
    const add = qbState.lastBuy?.count || 0;
    return Math.max(base, base + add);
  }, [lottery, qbState.lastBuy?.count]);

  const successOdds = useMemo(() => {
    if (soldEffective <= 0) return "100%";
    return clampPct(100 / soldEffective);
  }, [soldEffective]);

  const successSpentUi = useMemo(() => {
    if (!qbState.lastBuy) return "0";
    return fmtUsdcUi(qbMath.fmtUsdc(qbState.lastBuy.totalCostU.toString()));
  }, [qbMath, qbState.lastBuy]);

  const handleCollapseQuickBuy = useCallback(() => {
    try {
      qbActions.clearLastBuy?.();
    } catch {}
    setQbOpen(false);
  }, [qbActions]);

  // If lottery stops being “live”, close quick buy automatically
  useEffect(() => {
    if (!qbOpen) return;
    if (!isLiveForCard) handleCollapseQuickBuy();
  }, [qbOpen, isLiveForCard, handleCollapseQuickBuy]);

  // Clicking card body opens modal (unless quick-buy is open)
  const handleCardClick = useCallback(() => {
    if (qbOpen) {
      handleCollapseQuickBuy();
      return;
    }
    onOpen(lottery.id);
  }, [qbOpen, handleCollapseQuickBuy, onOpen, lottery.id]);

  // Click handler for “⚡ Buy Ticket” (expand quick buy)
  const handleBuyClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isLiveForCard) return;

      // ✅ NEW behavior:
      // Always expand first, then blur + show overlay if not signed in.
      setQbOpen(true);
    },
    [isLiveForCard]
  );

  const handleOverlayConnectClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenSignIn?.();
    },
    [onOpenSignIn]
  );

  return (
    <div className={cardClass} onClick={handleCardClick} role="button" tabIndex={0}>
      <div className="rc-notch left" />
      <div className="rc-notch right" />
      {ui.copyMsg && <div className="rc-toast">{ui.copyMsg}</div>}

      {/* --- HEADER SECTION --- */}
      <div className="rc-header">
        <div className={`rc-chip ${statusClass}`}>{endMode ? endChipNode : ui.displayStatus}</div>
        <div className="rc-winrate-badge" title="Win chance per ticket">
          🎲 Win: {winRateLabel}
        </div>
        <div className="rc-actions">
          <button
            className="rc-shield-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSafety?.(lottery.id);
            }}
            title="Verified Contract"
            disabled={!onOpenSafety}
          >
            🛡
          </button>
          <button
            className="rc-btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              actions.handleShare(e);
            }}
            title="Share"
          >
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
        ) : (
          <span>PPOPGI</span>
        )}
      </div>

      <div className="rc-title" title={titleText}>
        {displayName}
      </div>

      {/* --- PRIZE (Holographic) --- */}
      <div className="rc-prize-section">
        <div className="rc-prize-lbl">Prize Pool</div>
        <div className="rc-prize-val">
          <span className="rc-prize-num">{potUi}</span>
          <span className="rc-prize-unit">USDC</span>
        </div>
      </div>

      {/* --- STATS GRID (Moved Up) --- */}
      <div className="rc-grid">
        <div className="rc-stat">
          <div className="rc-stat-lbl">Ticket Price</div>
          <div className="rc-stat-val">{priceUi} USDC</div>
        </div>
        <div className="rc-stat">
          <div className="rc-stat-lbl">Tickets Sold</div>
          <div className="rc-stat-val">
            {ui.sold} {ui.hasMax && `/ ${ui.max}`}
          </div>
        </div>
      </div>

      {/* --- LIQUID BARS (Moved Up) --- */}
      {isLiveForCard && ui.hasMin && (
        <div className="rc-bar-group">
          {!ui.minReached ? (
            <>
              <div className="rc-bar-row">
                <span>Min Target</span>
                <span>
                  {ui.sold} / {ui.min}
                </span>
              </div>
              <div className="rc-track">
                <div className="rc-fill blue" style={{ width: ui.progressMinPct }} />
              </div>
            </>
          ) : (
            <>
              <div className="rc-bar-row">
                <span>Min Reached</span>
                <span>Ready</span>
              </div>
              <div className="rc-track">
                <div className="rc-fill green" style={{ width: "100%" }} />
              </div>
              <div className="rc-bar-row" style={{ marginTop: 8 }}>
                <span>Total Capacity</span>
                <span>{ui.hasMax ? `${ui.sold} / ${ui.max}` : "Unlimited"}</span>
              </div>
              <div className="rc-track">
                <div className="rc-fill purple" style={{ width: ui.progressMaxPct }} />
              </div>
            </>
          )}
        </div>
      )}

      {hatch && hatch.show && (
        <div className="rc-hatch" onClick={(e) => e.stopPropagation()}>
          <div className="rc-bar-row">
            <span>⚠️ Emergency</span>
            <span>{hatch.label}</span>
          </div>
          <button
            className={`rc-hatch-btn ${hatch.ready ? "ready" : ""}`}
            disabled={hatch.disabled || hatch.busy}
            onClick={hatch.onClick}
          >
            {hatch.busy ? "..." : hatch.ready ? "HATCH (CANCEL)" : "LOCKED"}
          </button>
        </div>
      )}

      {/* --- TEAR-OFF STUB (Footer Action) --- */}
      <div className="rc-stub-container">
        <div className="rc-perforation-line" />

        <div className="rc-stub-content" onClick={(e) => e.stopPropagation()}>
          {/* =========================
              QUICK BUY (collapsed)
             ========================= */}
          {!qbOpen && (
            <>
              {isLiveForCard ? (
                <button className="rc-quick-buy-btn" onClick={handleBuyClick}>
                  ⚡ Buy Ticket
                </button>
              ) : (
                endInfoBlock
              )}

              <div className="rc-stub-meta">
                <div className="rc-meta-left">{isLiveForCard ? `Ends: ${ui.timeLeft}` : displayStatus}</div>
                <div className="rc-meta-right">
                  <a
                    href={`${EXPLORER_URL}${lottery.id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rc-id-link"
                  >
                    #{lottery.id.slice(2, 8).toUpperCase()}
                  </a>
                </div>
              </div>
            </>
          )}

          {/* =========================
              QUICK BUY (expanded)
             ========================= */}
          {qbOpen && (
            <div
              className="rc-qb-wrap"
              style={{
                borderRadius: 16,
                padding: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.75)",
                position: "relative",
              }}
            >
              {showSuccess && qbState.lastBuy ? (
                // ✅ SUCCESS VIEW
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6 }}>✓ Tickets Purchased!</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
                    You bought <b>{qbState.lastBuy.count}</b> ticket{qbState.lastBuy.count === 1 ? "" : "s"}.
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      marginBottom: 10,
                      textAlign: "left",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.03)" }}>
                      <div style={{ fontSize: 10, opacity: 0.65, fontWeight: 800, marginBottom: 4, textTransform: "uppercase" }}>
                        Spent
                      </div>
                      <div style={{ fontWeight: 900 }}>{successSpentUi} USDC</div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.03)" }}>
                      <div style={{ fontSize: 10, opacity: 0.65, fontWeight: 800, marginBottom: 4, textTransform: "uppercase" }}>
                        Current odds
                      </div>
                      <div style={{ fontWeight: 900 }}>{successOdds}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {qbState.lastBuy.txHash && (
                      <a
                        className="rc-quick-buy-btn"
                        href={`${EXPLORER_TX_URL}${qbState.lastBuy.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ textDecoration: "none", textAlign: "center" }}
                      >
                        View Tx ↗
                      </a>
                    )}

                    <button
                      className="rc-quick-buy-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCollapseQuickBuy();
                      }}
                    >
                      ← Back
                    </button>
                  </div>
                </div>
              ) : (
                // ✅ COMPACT BUY VIEW (Prepare Wallet / Buy)
                <div className={`rc-qb-inner ${blurBuy ? "blurred" : ""}`} style={{ position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 900, opacity: 0.7 }}>
                    <span>Bal: {balanceUi} USDC</span>
                    <span>Cap: {uiMaxForStepper}</span>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, marginBottom: 10 }}>
                    <button
                      className="rdm-step-btn"
                      style={{ width: 46, height: 46, borderRadius: 14 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        qbActions.setTickets(String(Math.max(1, clampedUiTicket - 1)));
                      }}
                      disabled={clampedUiTicket <= 1}
                    >
                      −
                    </button>

                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{clampedUiTicket}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>Total: {totalUi} USDC</div>
                    </div>

                    <button
                      className="rdm-step-btn"
                      style={{ width: 46, height: 46, borderRadius: 14 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        qbActions.setTickets(String(Math.min(uiMaxForStepper, clampedUiTicket + 1)));
                      }}
                      disabled={clampedUiTicket >= uiMaxForStepper}
                    >
                      +
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {!qbFlags.hasEnoughAllowance ? (
                      <button
                        className="rc-quick-buy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          qbActions.approve();
                        }}
                        disabled={qbState.isPending}
                      >
                        {qbState.isPending ? "Preparing..." : "Prepare Wallet"}
                      </button>
                    ) : (
                      <button
                        className="rc-quick-buy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          qbActions.buy();
                        }}
                        disabled={!qbFlags.canBuy || qbState.isPending}
                      >
                        {qbState.isPending ? "Processing..." : `Buy ${clampedUiTicket}`}
                      </button>
                    )}

                    <button
                      className="rc-btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCollapseQuickBuy();
                      }}
                      title="Close"
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "rgba(0,0,0,0.03)",
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* ✅ Blur + clickable overlay (same idea as the modal) */}
              {blurBuy && (
                <button
                  type="button"
                  onClick={handleOverlayConnectClick}
                  aria-label="Open sign in"
                  style={{
                    position: "absolute",
                    inset: 0,
                    border: "none",
                    background: "transparent",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    zIndex: 20,
                  }}
                >
                  <span
                    style={{
                      background: "rgba(0,0,0,0.85)",
                      color: "white",
                      padding: "12px 18px",
                      borderRadius: 999,
                      fontWeight: 900,
                      fontSize: 13,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                    }}
                  >
                    Connect Wallet to Buy
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}