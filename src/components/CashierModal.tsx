import { useEffect, useMemo, useState } from "react";
import { useCashierData } from "../hooks/useCashierData";
import "./CashierModal.css";

import { BuyWidget, SwapWidget } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Tab = "wallet" | "buy" | "swap";

export function CashierModal({ open, onClose }: Props) {
  const { state, actions, display } = useCashierData(open);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("wallet");

  useEffect(() => {
    if (open) setTab("wallet");
  }, [open]);

  const handleCopy = () => {
    if (state.me) {
      navigator.clipboard.writeText(state.me);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const subtitle = useMemo(() => {
    if (tab === "buy") return "Buy crypto (on-ramp) to Etherlink";
    if (tab === "swap") return "Swap tokens on Etherlink";
    return "Balances & quick actions";
  }, [tab]);

  if (!open) return null;

  return (
    <div className="cm-overlay" onMouseDown={onClose}>
      <div className="cm-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cm-header">
          <div className="cm-header-left">
            <h3 className="cm-title">Cashier</h3>
            <div className="cm-subtitle">{subtitle}</div>
          </div>
          <button className="cm-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="cm-tabs">
          <button
            className={`cm-tab ${tab === "wallet" ? "active" : ""}`}
            onClick={() => setTab("wallet")}
          >
            Wallet
          </button>
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

        <div className="cm-body">
          {/* ---------- WALLET TAB ---------- */}
          {tab === "wallet" && (
            <>
              {/* Address Pill (Click to Copy) */}
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
                  <div className="cm-addr-val" onClick={handleCopy} title="Click to Copy">
                    {display.shortAddr}
                    <span className="cm-copy-icon">{copied ? "Copied" : "Copy"}</span>
                  </div>
                </div>

                <button className="cm-refresh-btn" onClick={actions.refresh} disabled={state.loading} title="Refresh">
                  {state.loading ? "..." : "🔄"}
                </button>
              </div>

              {state.note && <div className="cm-alert">⚠️ {state.note}</div>}

              {/* Balance Cards */}
              <div className="cm-balance-section">
                <div className="cm-section-label">Assets on Etherlink</div>

                <div className="cm-balance-grid">
                  {/* USDC Card (Primary) */}
                  <div className="cm-asset-card primary">
                    <div className="cm-asset-icon">💲</div>
                    <div>
                      <div className="cm-asset-amount">{display.usdc}</div>
                      <div className="cm-asset-name">USDC</div>
                    </div>
                    <div className="cm-asset-tag">Raffle Funds</div>
                  </div>

                  {/* XTZ Card (Secondary) */}
                  <div className="cm-asset-card secondary">
                    <div className="cm-asset-icon">⛽</div>
                    <div>
                      <div className="cm-asset-amount">{display.xtz}</div>
                      <div className="cm-asset-name">Tezos (XTZ)</div>
                    </div>
                    <div className="cm-asset-tag">Network Fees</div>
                  </div>
                </div>
              </div>

              {/* Quick actions (kept, but also point users to the new tabs) */}
              <div className="cm-guide-section">
                <div className="cm-section-label">Need Funds?</div>

                <div className="cm-guide-row" role="button" tabIndex={0} onClick={() => setTab("buy")}>
                  <div className="cm-guide-icon">💳</div>
                  <div className="cm-guide-text">
                    <strong>Buy with Card</strong>
                    <span>Use the in-app Buy widget (recommended).</span>
                  </div>
                  <button className="cm-guide-btn" type="button" onClick={() => setTab("buy")}>
                    Open
                  </button>
                </div>

                <div className="cm-guide-row" role="button" tabIndex={0} onClick={() => setTab("swap")}>
                  <div className="cm-guide-icon">💱</div>
                  <div className="cm-guide-text">
                    <strong>Swap for USDC</strong>
                    <span>Swap tokens directly in-app on Etherlink.</span>
                  </div>
                  <button className="cm-guide-btn" type="button" onClick={() => setTab("swap")}>
                    Open
                  </button>
                </div>

                {/* Keep external bridge link as a fallback */}
                <div className="cm-guide-row">
                  <div className="cm-guide-icon">🌉</div>
                  <div className="cm-guide-text">
                    <strong>Bridge Assets</strong>
                    <span>Move ETH / XTZ to Etherlink Mainnet.</span>
                  </div>
                  <a href="https://bridge.etherlink.com/" target="_blank" rel="noreferrer" className="cm-guide-btn">
                    Go
                  </a>
                </div>
              </div>
            </>
          )}

          {/* ---------- BUY TAB ---------- */}
          {tab === "buy" && (
            <div className="cm-widget-wrap">
              <div className="cm-widget-card">
                <BuyWidget client={thirdwebClient} chain={ETHERLINK_CHAIN} />
              </div>

              <div className="cm-widget-note">
                Buying methods depend on your region/provider. If one fails, try another inside the widget.
              </div>
            </div>
          )}

          {/* ---------- SWAP TAB ---------- */}
          {tab === "swap" && (
            <div className="cm-widget-wrap">
              <div className="cm-widget-card">
                <SwapWidget client={thirdwebClient} chain={ETHERLINK_CHAIN} />
              </div>

              <div className="cm-widget-note">
                Swaps require some native token for gas. Keep a little XTZ for fees.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CashierModal;