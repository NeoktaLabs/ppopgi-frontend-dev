// src/components/DisclaimerGate.tsx

import { useCallback } from "react";
import "./DisclaimerGate.css";

type Props = {
  open: boolean;
  onAccept: () => void;
};

export function DisclaimerGate({ open, onAccept }: Props) {
  
  const handleReadFAQ = useCallback(() => {
    // Dismiss the modal
    onAccept(); 
    // Dispatch the custom event to switch the page to FAQ
    try {
      window.dispatchEvent(new CustomEvent("ppopgi:navigate", { detail: { page: "faq" } }));
    } catch {}
  }, [onAccept]);

  if (!open) return null;

  return (
    <div className="dg-overlay">
      <div className="dg-card" role="dialog" aria-modal="true">
        
        {/* Header with Icon */}
        <div className="dg-header">
          <div className="dg-icon">⚠️</div>
          <h1 className="dg-title">Before you enter</h1>
        </div>

        <div className="dg-body">
          <p className="dg-text">
            Ppopgi is an experimental, unaudited decentralized application running on Etherlink.
            By continuing, you acknowledge and accept the following:
          </p>

          <ul className="dg-list">
            <li>
              <strong>Experimental Software:</strong> Smart contracts, indexers, bots, and UI may contain bugs, downtime, or unexpected behavior.
            </li>
            <li>
              <strong>No Guarantees:</strong> The protocol is provided "as is" without warranties, guarantees, or uptime commitments.
            </li>
            <li>
              <strong>Risk of Loss:</strong> Funds may be lost due to smart contract bugs, network issues, randomness failures, or infrastructure outages.
            </li>
            <li>
              <strong>User Responsibility:</strong> You are solely responsible for your funds, transactions, and interactions with the protocol.
            </li>
            <li>
              <strong>Use at Your Own Risk:</strong> Only participate with assets you can afford to lose.
            </li>
          </ul>

          <div className="dg-action-stack">
            <button className="dg-accept-btn" onClick={onAccept}>
              I Understand & Enter
            </button>
            
            <button className="dg-secondary-btn" onClick={handleReadFAQ}>
              Let me read the FAQ first
            </button>
          </div>

          <div className="dg-footer">
            By proceeding, you accept full responsibility and understand that blockchain transactions are irreversible.
          </div>
        </div>
      </div>
    </div>
  );
}
