// src/components/SafetyProofModal.tsx
import React from "react";
import type { RaffleDetails } from "../hooks/useRaffleDetails";
import { useSafetyBreakdown } from "../hooks/useSafetyBreakdown";
import "./SafetyProofModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  raffle: RaffleDetails;
};

// Helper: Status Text
function statusLabel(s: string) {
  const map: Record<string, string> = {
    FUNDING_PENDING: "Getting Ready",
    OPEN: "Open",
    DRAWING: "Drawing",
    COMPLETED: "Settled",
    CANCELED: "Canceled"
  };
  return map[s] || "Unknown";
}

// Helper: Clickable Link
const ExplorerLink = ({ addr, children }: { addr?: string, children: React.ReactNode }) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return <span>—</span>;
  return (
    <a 
      href={`https://explorer.etherlink.com/address/${addr}`} 
      target="_blank" rel="noreferrer" 
      className="sp-link"
    >
      {children}
    </a>
  );
};

// Helper: Truncate
const short = (s?: string) => s ? `${s.slice(0,6)}…${s.slice(-4)}` : "—";

export function SafetyProofModal({ open, onClose, raffle }: Props) {
  // 1. Hook for Math
  const breakdown = useSafetyBreakdown(raffle);

  if (!open) return null;

  return (
    <div className="sp-overlay" onMouseDown={onClose}>
      <div className="sp-card" onMouseDown={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sp-header">
           <div className="sp-badge">
             🛡️ Safety Proof
           </div>
           <button className="sp-close-btn" onClick={onClose}>Close</button>
        </div>

        {/* Intro */}
        <div className="sp-body">
           <div className="sp-intro">
              <div className="sp-intro-title">Verified On-Chain Data</div>
              <div className="sp-intro-text">
                The app only reads contract state. It cannot change rules, select winners, or move funds unexpectedly.
              </div>
           </div>

           <div className="sp-tear" />

           {/* SECTION 1: STATUS & CONTRACTS */}
           <div className="sp-panel">
              <div className="sp-panel-title">📜 Contract Status</div>
              
              <div className="sp-row">
                 <span className="sp-lbl">State</span>
                 <span className="sp-val">{statusLabel(raffle.status)}</span>
              </div>
              <div className="sp-row">
                 <span className="sp-lbl">Raffle Contract</span>
                 <span className="sp-val sp-mono">
                    <ExplorerLink addr={raffle.address}>{short(raffle.address)}</ExplorerLink>
                 </span>
              </div>
              <div className="sp-row">
                 <span className="sp-lbl">USDC Asset</span>
                 <span className="sp-val sp-mono">
                    <ExplorerLink addr={raffle.usdcToken}>{short(raffle.usdcToken)}</ExplorerLink>
                 </span>
              </div>
           </div>

           {/* SECTION 2: MONEY FLOW (Your Breakdown Logic) */}
           <div className="sp-panel">
              <div className="sp-panel-title">💰 Who Gets What</div>
              
              <div className="sp-row">
                 <span className="sp-lbl">Winner Prize</span>
                 <span className="sp-val">{breakdown.pot} USDC</span>
              </div>
              <div className="sp-row">
                 <span className="sp-lbl">Creator Share (So Far)</span>
                 <span className="sp-val">{breakdown.creatorSoFar} USDC</span>
              </div>
              <div className="sp-row">
                 <span className="sp-lbl">Protocol Fee ({breakdown.pct}%)</span>
                 <span className="sp-val">{breakdown.fee} USDC</span>
              </div>
              
              <div className="sp-tear" style={{ margin: "10px 0", opacity: 0.3 }} />
              
              <div className="sp-row">
                 <span className="sp-lbl">Fee Receiver</span>
                 <span className="sp-val sp-mono">
                    <ExplorerLink addr={raffle.feeRecipient}>{short(raffle.feeRecipient)}</ExplorerLink>
                 </span>
              </div>
              <div className="sp-note">Creator share is calculated based on tickets sold to date.</div>
           </div>

           {/* SECTION 3: RANDOMNESS */}
           <div className="sp-panel">
              <div className="sp-panel-title">🎲 Fairness Engine</div>
              <div className="sp-row">
                 <span className="sp-lbl">Entropy Source</span>
                 <span className="sp-val sp-mono">
                    <ExplorerLink addr={raffle.entropyProvider}>{short(raffle.entropyProvider)}</ExplorerLink>
                 </span>
              </div>
              <div className="sp-note">
                 Winner selection uses provable on-chain randomness. No one (including the admin) can predict the result.
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}
