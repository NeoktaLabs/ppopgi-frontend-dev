// src/components/CashierModal.tsx
import { useMemo, useState } from "react";
import { useCashierData } from "../hooks/useCashierData";
import "./CashierModal.css";

// ✅ thirdweb widget
import { BuyWidget } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Tab = "buy_usdc" | "buy_xtz" | "swap";

export function CashierModal({ open, onClose }: Props) {
  const { state, actions, display } = useCashierData(open);
  const [copied, setCopied] = useState(false);

  // ✅ 3 tabs
  const [tab, setTab] = useState<Tab>("buy_xtz");

  const handleCopy = () => {
    if (state.me) {
      navigator.clipboard.writeText(state.me);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ✅ Etherlink USDC address (replace if yours differs)
  const USDC_ADDRESS = "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9";

  // Best-effort token restriction list (depends on widget version)
  const supportedTokens = useMemo(() => {
    return [
      { chainId: ETHERLINK_CHAIN.id, tokenAddress: "native" }, // XTZ native
      { chainId: ETHERLINK_CHAIN.id, tokenAddress: USDC_ADDRESS },
    ];
  }, []);

  // ✅ Bridge link (Swap tab)
  const ETHERLINK_BRIDGE_URL = "https://bridge.etherlink.com/";

  if (!open) return null;

  return (
    <div className="cm-overlay" onMouseDown={onClose}>
      <div className="cm-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cm-header">
          <h3 className="cm-title">My Wallet</h3>
          <button className="cm-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="cm-body">
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

            <button className="cm-refresh-btn" onClick={actions.refresh} disabled={state.loading}>
              {state.loading ? "..." : "🔄"}
            </button>
          </div>

          {state.note && <div className="cm-alert">⚠️ {state.note}</div>}

          {/* Balance Cards */}
          <div className="cm-balance-section">
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
                  <div className="cm-asset-name">Tezos (XTZ)</div>
                </div>
                <div className="cm-asset-tag">Network Fees</div>
              </div>
            </div>
          </div>

          {/* ✅ 3 Tabs */}
          <div className="cm-tabs3">
            <button className={`cm-tab3 ${tab === "buy_usdc" ? "active" : ""}`} onClick={() => setTab("buy_usdc")}>
              Buy USDC
            </button>
            <button className={`cm-tab3 ${tab === "buy_xtz" ? "active" : ""}`} onClick={() => setTab("buy_xtz")}>
              Buy XTZ
            </button>
            <button className={`cm-tab3 ${tab === "swap" ? "active" : ""}`} onClick={() => setTab("swap")}>
              Swap
            </button>
          </div>

          {/* ✅ Content Area */}
          <div className="cm-widget-shell">
            {tab === "buy_usdc" && (
              <div className="cm-widget-wrap">
                <BuyWidget
                  // ✅ force reset so it never “sticks” to previous token
                  key="buy_usdc"
                  client={thirdwebClient}
                  chain={ETHERLINK_CHAIN}
                  theme="light"
                  title="Buy USDC (Etherlink)"
                  tokenAddress={USDC_ADDRESS as any}
                  tokenEditable={false}
                  amountEditable={true}
                  supportedTokens={supportedTokens as any}
                  paymentMethods={["crypto", "card"]}
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {tab === "buy_xtz" && (
              <div className="cm-widget-wrap">
                <BuyWidget
                  key="buy_xtz"
                  client={thirdwebClient}
                  chain={ETHERLINK_CHAIN}
                  theme="light"
                  title="Buy XTZ (Etherlink)"
                  tokenAddress={undefined as any} // native
                  tokenEditable={false}
                  amountEditable={true}
                  supportedTokens={supportedTokens as any}
                  paymentMethods={["crypto", "card"]}
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {tab === "swap" && (
              <div className="cm-bridge-box">
                <div className="cm-bridge-title">Bridge USDC from Ethereum → Etherlink</div>
                <div className="cm-bridge-text">
                  To use the raffles, you can bridge <b>USDC</b> from <b>Ethereum</b> to <b>Etherlink</b> using the official
                  Etherlink Bridge.
                </div>

                <a className="cm-bridge-btn" href={ETHERLINK_BRIDGE_URL} target="_blank" rel="noreferrer">
                  Open Etherlink Bridge
                </a>

                <div className="cm-bridge-footnote">
                  Tip: Keep a little XTZ on Etherlink for gas fees.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}