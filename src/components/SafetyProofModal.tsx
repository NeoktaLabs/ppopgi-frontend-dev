// src/components/SafetyProofModal.tsx

import type { RaffleDetails } from "../hooks/useRaffleDetails";
import { useSafetyBreakdown } from "../hooks/useSafetyBreakdown";
import "./SafetyProofModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  raffle: RaffleDetails;
};

// Helper: Clickable Link
const ExplorerLink = ({ addr, label }: { addr?: string, label: string }) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return <span className="sp-mono">—</span>;
  return (
    <a 
      href={`https://explorer.etherlink.com/address/${addr}`} 
      target="_blank" rel="noreferrer" 
      className="sp-link"
      title={addr}
    >
      {label} ↗
    </a>
  );
};

const short = (s?: string) => s ? `${s.slice(0,6)}...${s.slice(-4)}` : "—";

export function SafetyProofModal({ open, onClose, raffle }: Props) {
  const breakdown = useSafetyBreakdown(raffle);

  if (!open) return null;

  return (
    <div className="sp-overlay" onMouseDown={onClose}>
      <div className="sp-card" onMouseDown={e => e.stopPropagation()}>
        
        {/* Header: Verified Badge Style */}
        <div className="sp-header">
           <div className="sp-header-left">
             <div className="sp-shield-icon">🛡️</div>
             <div>
               <h3 className="sp-title">Verified Contract</h3>
               <div className="sp-subtitle">Immutable • Non-Custodial • On-Chain</div>
             </div>
           </div>
           <button className="sp-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="sp-body">
           
           {/* 1. STATUS GRID */}
           <div className="sp-section-grid">
              <div className="sp-data-box">
                 <div className="sp-lbl">Contract Status</div>
                 <div className={`sp-status-pill ${raffle.status.toLowerCase()}`}>
                    {raffle.status.replace("_", " ")}
                 </div>
              </div>
              <div className="sp-data-box">
                 <div className="sp-lbl">Raffle Address</div>
                 <ExplorerLink addr={raffle.address} label={short(raffle.address)} />
              </div>
              <div className="sp-data-box">
                 <div className="sp-lbl">Asset Token</div>
                 <ExplorerLink addr={raffle.usdcToken} label="USDC (Standard)" />
              </div>
              <div className="sp-data-box">
                 <div className="sp-lbl">Creator</div>
                 <ExplorerLink addr={raffle.creator} label={short(raffle.creator)} />
              </div>
           </div>

           {/* 2. THE MONEY TRAIL */}
           <div className="sp-panel money-panel">
              <div className="sp-panel-header">
                 <span>💰 Funds Allocation</span>
                 <span className="sp-verified-check">✓ Verified Logic</span>
              </div>
              
              <div className="sp-money-row highlight">
                 <span>Winner Prize Pool</span>
                 <span className="sp-money-val">{breakdown.pot} USDC</span>
              </div>

              <div className="sp-divider" />

              <div className="sp-money-row">
                 <span>Platform Fee ({breakdown.pct}%)</span>
                 <span>{breakdown.fee} USDC</span>
              </div>
              <div className="sp-money-row">
                 <span>Creator Earnings</span>
                 <span>{breakdown.creatorSoFar} USDC</span>
              </div>
              
              <div className="sp-micro-note">
                 Funds are held by the smart contract, not by Ppopgi. Only the winner or the creator (for their share) can withdraw.
              </div>
           </div>

           {/* 3. RANDOMNESS */}
           <div className="sp-panel rng-panel">
              <div className="sp-panel-header">
                 <span>🎲 Fairness Engine</span>
              </div>
              <div className="sp-rng-content">
                 <div className="sp-rng-text">
                    Winner selection is determined by a <strong>Verifiable Random Function (VRF)</strong>. 
                    This ensures the result cannot be predicted, manipulated, or timed by anyone—including the creator.
                 </div>
                 <div className="sp-data-box compact">
                    <div className="sp-lbl">Entropy Source</div>
                    <ExplorerLink addr={raffle.entropyProvider} label={short(raffle.entropyProvider)} />
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}
