// src/components/DisclaimerGate.tsx

import "./DisclaimerGate.css";

type Props = {
  open: boolean;
  onAccept: () => void;
};

export function DisclaimerGate({ open, onAccept }: Props) {
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

          <button className="dg-accept-btn" onClick={onAccept}>
            I Understand & Agree
          </button>

          {/* ✅ FAQ link */}
          <div className="dg-faq">
            New here?{" "}
            <a href="?page=faq" className="dg-faq-link">
              Learn more in the FAQ →
            </a>
          </div>

          <div className="dg-footer">
            By proceeding, you accept full responsibility and understand that blockchain transactions are irreversible.
          </div>
        </div>
      </div>
    </div>
  );
}