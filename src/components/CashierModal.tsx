import { useState } from "react";
import { useCashierData } from "../hooks/useCashierData";
import { BuyWidget, SwapWidget } from "@thirdweb-dev/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import "./CashierModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CashierModal({ open, onClose }: Props) {
  const { state, actions, display } = useCashierData(open);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"buy" | "swap">("buy");

  const handleCopy = () => {
    if (!state.me) return;
    navigator.clipboard.writeText(state.me);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="cm-overlay" onMouseDown={onClose}>
      <div className="cm-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cm-header">
          <h3 className="cm-title">My Wallet</h3>
          <button className="cm-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="cm-body">
          {/* Address */}
          <div className="cm-address-row">
            <div
              className="cm-avatar-circle"
              style={{
                background: copied ? "#dcfce7" : "#f1f5f9",
                color: copied ? "#166534" : "#64748b",
              }}
            >
              {copied ? "✓" : "👤"}
            </div>

            <div className="cm-address-info">
              <div className="cm-label">Connected Account</div>
              <div className="cm-addr-val" onClick={handleCopy}>
                {display.shortAddr}
                <span className="cm-copy-icon">
                  {copied ? "Copied" : "Copy"}
                </span>
              </div>
            </div>

            <button
              className="cm-refresh-btn"
              onClick={actions.refresh}
              disabled={state.loading}
            >
              {state.loading ? "…" : "🔄"}
            </button>
          </div>

          {/* Balances */}
          <div className="cm-section-label">Assets on Etherlink</div>
          <div className="cm-balance-grid">
            <div className="cm-asset-card primary">
              <div className="cm-asset-icon">💲</div>
              <div>
                <div className="cm-asset-amount">{display.usdc}</div>
                <div className="cm-asset-name">USDC</div>
              </div>
              <div className="cm-asset-tag">Raffle Funds</div>
            </div>

            <div className="cm-asset-card secondary">
              <div className="cm-asset-icon">⛽</div>
              <div>
                <div className="cm-asset-amount">{display.xtz}</div>
                <div className="cm-asset-name">XTZ</div>
              </div>
              <div className="cm-asset-tag">Gas</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="cm-tabs">
            <button
              className={`cm-tab ${tab === "buy" ? "active" : ""}`}
              onClick={() => setTab("buy")}
            >
              Buy
            </button>
            <button
              className={`cm-tab ${tab === "swap" ? "active" : ""}`}
              onClick={() => setTab("swap")}
            >
              Swap
            </button>
          </div>

          {/* Thirdweb widgets */}
          <div className="cm-widget-wrap">
            <div className="cm-widget-card">
              {tab === "buy" && (
                <BuyWidget
                  client={thirdwebClient}
                  chain={ETHERLINK_CHAIN}
                  chains={[ETHERLINK_CHAIN]}
                  theme="light"
                />
              )}

              {tab === "swap" && (
                <SwapWidget
                  client={thirdwebClient}
                  chain={ETHERLINK_CHAIN}
                  chains={[ETHERLINK_CHAIN]}
                  theme="light"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CashierModal;