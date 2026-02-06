// src/components/RaffleCard.tsx
import React, { useMemo } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { useRaffleCard } from "../hooks/useRaffleCard";
import "./RaffleCard.css";

const EXPLORER_URL = "https://explorer.etherlink.com/address/";

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

const short = (addr: string) => (addr ? `${addr.slice(0, 5)}...${addr.slice(-4)}` : "Unknown");

// Helper: parse "1,234.56" safely
function toNumber(s: any): number {
  const raw = String(s ?? "").replace(/,/g, "").trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function RaffleCard({ raffle, onOpen, onOpenSafety, ribbon, nowMs = Date.now(), hatch, userEntry }: Props) {
  const { ui, actions } = useRaffleCard(raffle, nowMs);

  const statusClass = ui.displayStatus.toLowerCase().replace(" ", "-");
  const cardClass = `rc-card ${ribbon || ""}`;
  const showHatch = hatch && hatch.show;

  const hostAddr = (raffle as any).owner || (raffle as any).creator;

  // Odds Label
  const oddsLabel = useMemo(() => {
    if (!ui.isLive) return null;
    const max = Number(raffle.maxTickets);
    const sold = Number(raffle.sold);

    const denominator = max > 0 ? max : sold + 1;
    if (denominator === 0) return "0%";

    const pct = (1 / denominator) * 100;
    if (pct >= 100) return "100%";
    if (pct < 0.01) return "<0.01%";
    return pct < 1 ? `${pct.toFixed(2)}%` : `${Math.round(pct)}%`;
  }, [raffle.maxTickets, raffle.sold, ui.isLive]);

  // ✅ Net prize (winner receives 90%). We keep it purely UI-level for now.
  const netPrizeStr = useMemo(() => {
    const gross = toNumber(ui.formattedPot);
    const net = gross * 0.9;
    return net.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }, [ui.formattedPot]);

  return (
    <div className={cardClass} onClick={() => onOpen(raffle.id)} role="button" tabIndex={0}>
      <div className="rc-notch left" />
      <div className="rc-notch right" />
      {ui.copyMsg && <div className="rc-toast">{ui.copyMsg}</div>}

      {/* Header */}
      <div className="rc-header">
        <div className={`rc-chip ${statusClass}`}>{ui.displayStatus}</div>

        {oddsLabel && !userEntry && (
          <div className="rc-odds-badge" title="Win chance per ticket">
            🎲 Win: {oddsLabel}
          </div>
        )}

        <div className="rc-actions">
          <button
            className="rc-shield-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSafety?.(raffle.id);
            }}
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
        ) : (
          <span>PPOPGI</span>
        )}
      </div>

      <div className="rc-title" title={raffle.name}>
        {raffle.name}
      </div>

      {/* Prize Section */}
      <div className="rc-prize-lbl">Current Prize Pool</div>

      {/* ✅ Ensure USDC is visible (unit is not inside gradient) */}
      <div className="rc-prize-row">
        <div className="rc-prize-val">
          <span className="rc-prize-num">{ui.formattedPot}</span>
          <span className="rc-prize-unit">USDC</span>
        </div>
      </div>

      {/* ✅ Small transparency line */}
      <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", marginTop: 2, fontWeight: 700, opacity: 0.9 }}>
        Net to winner: <b>{netPrizeStr} USDC</b> <span style={{ opacity: 0.8 }}>*</span>
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", marginTop: 2, fontWeight: 700, opacity: 0.8 }}>
        *See details for exact distribution
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
              <div className="rc-bar-row">
                <span>Min To Draw</span>
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
                <span>Capacity</span>
                <span>{ui.hasMax ? `${ui.sold} / ${ui.max}` : "Unlimited"}</span>
              </div>
              <div className="rc-track">
                <div className="rc-fill purple" style={{ width: ui.progressMaxPct }} />
              </div>
            </>
          )}
        </div>
      )}

      {showHatch && (
        <div className="rc-hatch" onClick={(e) => e.stopPropagation()}>
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
          {hatch.note && (
            <div style={{ fontSize: 10, marginTop: 4, textAlign: "center", fontWeight: 800, textTransform: "uppercase" }}>
              {hatch.note}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="rc-footer-new">
        <div className="rc-footer-left">{ui.isLive ? `Ends: ${ui.timeLeft}` : ui.displayStatus}</div>
        <div className="rc-footer-right">
          <div className="rc-barcode-div" />
          <a
            href={`${EXPLORER_URL}${raffle.id}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rc-id-link"
            title="View Contract"
          >
            #{raffle.id.slice(2, 8).toUpperCase()}
          </a>
        </div>
      </div>
    </div>
  );
}