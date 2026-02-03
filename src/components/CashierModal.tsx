import React from "react";
import { useCashierData } from "../hooks/useCashierData";
import "./CashierModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CashierModal({ open, onClose }: Props) {
  // 1. Hook handles logic + formatting
  const { state, actions, display } = useCashierData(open);

  if (!open) return null;

  return (
    <div className="cm-overlay" onMouseDown={onClose}>
      <div className="cm-card" onMouseDown={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="cm-header">
          <div>
            <h3 className="cm-title">Cashier</h3>
            <div className="cm-subtitle">View your balances on Etherlink</div>
          </div>
          
          <div className="cm-actions">
             <span className="cm-badge" title={state.me || ""}>
               {display.shortAddr}
             </span>
             <button 
               className="cm-btn primary" 
               onClick={actions.refresh} 
               disabled={state.loading}
             >
               {state.loading ? "Syncing..." : "Refresh"}
             </button>
             <button className="cm-btn secondary" onClick={onClose}>
               Close
             </button>
          </div>
        </div>

        {/* Body */}
        <div className="cm-body">
          {state.note && (
             <div style={{ padding: 12, borderRadius: 12, background: "#fff0f0", color: "#d32f2f", fontSize: 13, fontWeight: 800 }}>
               {state.note}
             </div>
          )}

          {/* Balances */}
          <div>
             <div style={{ fontWeight: 1000, fontSize: 14, textTransform: 'uppercase', opacity: 0.8 }}>Your Wallet</div>
             <div className="cm-balance-grid">
                {/* XTZ Card */}
                <div className="cm-balance-card">
                   <div className="cm-coin-label">XTZ (Native)</div>
                   <div className="cm-amount">{display.xtz}</div>
                   <div className="cm-hint">Used for gas fees</div>
                </div>

                {/* USDC Card */}
                <div className="cm-balance-card">
                   <div className="cm-coin-label">USDC</div>
                   <div className="cm-amount">{display.usdc}</div>
                   <div className="cm-hint">Used for tickets & prizes</div>
                </div>
             </div>
          </div>

          {/* Getting Started Guide */}
          <div className="cm-steps">
             <div style={{ fontWeight: 1000, fontSize: 14 }}>Quick Start Guide</div>
             
             <div className="cm-step-row">
                <div className="cm-step-num">1</div>
                <div>
                   <div style={{ fontWeight: 950 }}>Get XTZ</div>
                   <div style={{ fontSize: 13, opacity: 0.8 }}>You need a small amount of Tezos (XTZ) to pay for gas fees.</div>
                </div>
             </div>

             <div className="cm-step-row">
                <div className="cm-step-num">2</div>
                <div>
                   <div style={{ fontWeight: 950 }}>Bridge Funds</div>
                   <div style={{ fontSize: 13, opacity: 0.8 }}>Move assets from Tezos L1 or Ethereum to Etherlink using the official bridge.</div>
                </div>
             </div>

             <div className="cm-step-row">
                <div className="cm-step-num">3</div>
                <div>
                   <div style={{ fontWeight: 950 }}>Get USDC</div>
                   <div style={{ fontSize: 13, opacity: 0.8 }}>Swap for USDC on a DEX to start creating or joining raffles.</div>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
