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
            Ppopgi is an experimental, unaudited decentralized app on Etherlink.
            By entering, you acknowledge:
          </p>

          <ul className="dg-list">
            <li>
              <strong>Experimental Tech:</strong> Smart contracts and UI are provided "as is" and may contain bugs or
              experience downtime.
            </li>
            <li>
              <strong>Risk of Loss:</strong> You could lose funds due to network failures, contract exploits, or
              infrastructure outages.
            </li>
            <li>
              <strong>Service Availability:</strong> Off-chain components (indexer, bots, frontend, cache) may fail or
              lag, affecting UI accuracy or availability.
            </li>
            <li>
              <strong>Your Responsibility:</strong> You are solely responsible for your assets, transactions, and any
              risks taken.
            </li>
          </ul>

          <button className="dg-accept-btn" onClick={onAccept}>
            Agree and take me to Ppopgi
          </button>

          <div className="dg-footer">
            Only participate with assets you can afford to lose.
            <br />
            All blockchain transactions are irreversible.
            <br />
            Ppopgi creators are not liable for losses, downtime, or unexpected behavior.
          </div>
        </div>
      </div>
    </div>
  );
}