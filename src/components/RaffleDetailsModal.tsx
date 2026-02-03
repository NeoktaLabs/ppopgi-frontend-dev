// src/components/RaffleDetailsModal.tsx
import React, { useState } from "react";
import { ADDRESSES } from "../config/contracts";
import { useRaffleInteraction } from "../hooks/useRaffleInteraction";
import "./RaffleDetailsModal.css";
import "./RaffleCard.css"; // Reuse existing title clamp if needed

// ✅ Helper Component for Clickable Addresses
const ExplorerLink = ({ addr, children }: { addr: string; children: React.ReactNode }) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    return <span>{children}</span>;
  }
  return (
    <a
      href={`https://explorer.etherlink.com/address/${addr}`}
      target="_blank"
      rel="noreferrer"
      style={{
        color: "inherit",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
        cursor: "pointer",
      }}
      title="View on Explorer"
    >
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
  // 1. All Logic & State is here
  const { state, math, flags, actions } = useRaffleInteraction(raffleId, open);
  const [safetyOpen, setSafetyOpen] = useState(false);

  // 2. Simple Formatting Helpers for View
  const statusClass = state.displayStatus.toLowerCase().replace(" ", "-");

  // Format the countdown or status text
  const getBottomText = () => {
    if (state.displayStatus === "Open") {
      const diff = Math.max(0, math.deadlineMs - math.nowMs) / 1000;
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      return `Ends in ${d > 0 ? d + "d " : ""}${h}h ${m}m`;
    }
    return state.displayStatus;
  };

  if (!open) return null;

  return (
    <div className="rdm-overlay" onMouseDown={onClose}>
      <div className="rdm-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* Decorations */}
        <div className="rdm-notch" style={{ left: -9 }} />
        <div className="rdm-notch" style={{ right: -9 }} />
        {state.copyMsg && <div className="rdm-copy-toast">{state.copyMsg}</div>}

        {/* Header */}
        <div className="rdm-top">
          <div className={`rdm-chip ${statusClass}`}>{state.displayStatus}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="rdm-btn-mini" onClick={actions.handleShare}>
              Copy Link
            </button>
            <button
              className="rdm-btn-mini"
              onClick={() => setSafetyOpen(!safetyOpen)}
              disabled={!state.data}
            >
              🛡️ Safety
            </button>
            <button className="rdm-btn-mini" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Title & Prize */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <div className="rdm-label" style={{ fontSize: 12, fontWeight: 800 }}>
            Ppopgi
          </div>
          <div
            className="rdm-title pp-rc-titleClamp"
            title={state.data?.name}
          >
            {state.data?.name || "Loading..."}
          </div>
          
          {/* Raffle ID Link */}
          {raffleId && (
             <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
                <ExplorerLink addr={raffleId}>
                   #{raffleId.slice(2, 8).toUpperCase()}
                </ExplorerLink>
             </div>
          )}

          <div
            className="rdm-label"
            style={{ fontSize: 12, marginTop: 14, letterSpacing: 0.5 }}
          >
            WINNER GETS
          </div>
          <div className="rdm-prize-val">
            {math.fmtUsdc(state.data?.winningPot || "0")} USDC
          </div>
        </div>

        <div className="rdm-tear" />

        {/* Stats Grid */}
        <div className="rdm-grid-2">
          <div className="rdm-panel" style={{ marginTop: 0 }}>
            <span className="rdm-label" style={{ fontSize: 11 }}>
              Ticket Price
            </span>
            <span className="rdm-val">
              {math.fmtUsdc(state.data?.ticketPrice || "0")} USDC
            </span>
          </div>
          <div className="rdm-panel" style={{ marginTop: 0 }}>
            <span className="rdm-label" style={{ fontSize: 11 }}>
              Sold / Max
            </span>
            <span className="rdm-val">
              {state.data?.sold || "0"} /{" "}
              {state.data?.maxTickets === "0" ? "∞" : state.data?.maxTickets}
            </span>
          </div>
        </div>

        {/* Join Panel */}
        <div className="rdm-panel">
          <span className="rdm-val" style={{ fontSize: 16 }}>
            {flags.raffleIsOpen ? "Join Raffle" : "Join Unavailable"}
          </span>

          {!flags.raffleIsOpen ? (
            <span className="rdm-label" style={{ fontSize: 13 }}>
              {state.displayStatus === "Open"
                ? "Time ended. Finalizing..."
                : `Raffle is ${state.displayStatus.toLowerCase()}.`}
            </span>
          ) : (
            <>
              <div className="rdm-row">
                <span>Total Cost</span>
                <span className="rdm-val">
                  {math.fmtUsdc(math.totalCostU.toString())} USDC
                </span>
              </div>

              <div className="rdm-input-row">
                <button
                  className="rdm-btn-mini"
                  onClick={() => actions.setTickets(String(math.ticketCount - 1))}
                >
                  −
                </button>
                <input
                  className="rdm-input"
                  value={state.tickets}
                  onChange={(e) => actions.setTickets(e.target.value)}
                />
                <button
                  className="rdm-btn-mini"
                  onClick={() => actions.setTickets(String(math.ticketCount + 1))}
                >
                  +
                </button>
              </div>

              <div className="rdm-row" style={{ marginTop: 6, fontSize: 11 }}>
                <span>
                  Min: {math.minBuy} • Max: {math.maxBuy}
                </span>
                <span>
                  {state.usdcBal !== null &&
                    `Bal: ${math.fmtUsdc(state.usdcBal.toString())}`}
                  {state.allowance !== null &&
                    ` • Allow: ${math.fmtUsdc(state.allowance.toString())}`}
                </span>
              </div>

              {!flags.hasEnoughAllowance ? (
                <button
                  className="rdm-btn-big"
                  onClick={actions.approve}
                  disabled={state.isPending}
                >
                  {state.isPending ? "Approving..." : "1. Approve USDC"}
                </button>
              ) : (
                <button
                  className="rdm-btn-big"
                  onClick={actions.buy}
                  disabled={!flags.canBuy || state.isPending}
                >
                  {state.isPending ? "Buying..." : "2. Buy Tickets"}
                </button>
              )}

              {state.buyMsg && (
                <div
                  className="rdm-label"
                  style={{
                    textAlign: "center",
                    marginTop: 8,
                    fontWeight: 800,
                  }}
                >
                  {state.buyMsg}
                </div>
              )}
            </>
          )}
        </div>

        {/* Winner Panel */}
        {state.displayStatus === "Settled" && (
          <div className="rdm-panel">
            <span className="rdm-val">Winner</span>
            <div className="rdm-row">
              <span>Address</span>
              <span className="rdm-val">
                <ExplorerLink addr={state.data?.winner || ""}>
                   {math.short(state.data?.winner || "")}
                </ExplorerLink>
              </span>
            </div>
            <div className="rdm-row">
              <span>Prize</span>
              <span className="rdm-val">
                {math.fmtUsdc(state.data?.winningPot || "0")} USDC
              </span>
            </div>
          </div>
        )}

        {/* Safety Details (Toggle) */}
        {safetyOpen && state.data && (
          <div className="rdm-panel">
            <span className="rdm-val">Safety Info</span>
            
            <div className="rdm-row">
              <span>USDC</span>
              <span>
                 <ExplorerLink addr={state.data.usdcToken || ADDRESSES.USDC}>
                    {math.short(state.data.usdcToken || ADDRESSES.USDC)}
                 </ExplorerLink>
              </span>
            </div>
            
            <div className="rdm-row">
              <span>Fee Receiver</span>
              <span>
                 <ExplorerLink addr={state.data.feeRecipient}>
                    {math.short(state.data.feeRecipient)}
                 </ExplorerLink>
              </span>
            </div>
            
            <div className="rdm-row">
              <span>Entropy</span>
              <span>
                 <ExplorerLink addr={state.data.entropy}>
                    {math.short(state.data.entropy)}
                 </ExplorerLink>
              </span>
            </div>

            <div className="rdm-row">
              <span>Entropy Provider</span>
              <span>
                 <ExplorerLink addr={state.data.entropyProvider}>
                    {math.short(state.data.entropyProvider)}
                 </ExplorerLink>
              </span>
            </div>

            <div className="rdm-row">
              <span>Selected Provider</span>
              <span>
                 <ExplorerLink addr={state.data.selectedProvider}>
                    {math.short(state.data.selectedProvider)}
                 </ExplorerLink>
              </span>
            </div>

            <div className="rdm-row">
              <span>Deployer</span>
              <span>
                 <ExplorerLink addr={ADDRESSES.SingleWinnerDeployer}>
                    {math.short(ADDRESSES.SingleWinnerDeployer)}
                 </ExplorerLink>
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
            opacity: 0.8,
          }}
        >
          <span className="rdm-val" style={{ fontSize: 14 }}>
            {getBottomText()}
          </span>
          <span>✨</span>
        </div>
      </div>
    </div>
  );
}
