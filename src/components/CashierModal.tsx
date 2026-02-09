// src/components/CashierModal.tsx
import { useMemo, useState } from "react";
import { useCashierData } from "../hooks/useCashierData";
import "./CashierModal.css";

// ✅ thirdweb widgets
import { BuyWidget, SwapWidget } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type Props = {
  open: boolean;
  onClose: () => void;
};

type CashierTab = "buy" | "swap";
type BuyToken = "XTZ" | "USDC";

export function CashierModal({ open, onClose }: Props) {
  const { state, actions, display } = useCashierData(open);
  const [copied, setCopied] = useState(false);

  // ✅ new tabs
  const [tab, setTab] = useState<CashierTab>("buy");
  const [buyToken, setBuyToken] = useState<BuyToken>("XTZ");

  const handleCopy = () => {
    if (state.me) {
      navigator.clipboard.writeText(state.me);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ✅ Etherlink token addresses
  // NOTE: Replace USDC address if you use a different one on Etherlink.
  // XTZ native -> no tokenAddress required for BuyWidget (leave undefined).
  const USDC_ADDRESS = "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9";

  // ✅ Restrict widget token choices (best-effort)
  // Some thirdweb widget versions use `supportedTokens` differently;
  // we also lock `tokenEditable={false}` + remount on changes.
  const supportedTokens = useMemo(() => {
    return [
      { chainId: ETHERLINK_CHAIN.id, tokenAddress: "native" }, // XTZ native
      { chainId: ETHERLINK_CHAIN.id, tokenAddress: USDC_ADDRESS },
    ];
  }, []);

  const buyWidgetProps = useMemo(() => {
    if (buyToken === "USDC") {
      return {
        title: "Buy USDC (Etherlink)",
        tokenAddress: USDC_ADDRESS,
      };
    }
    return {
      title: "Buy XTZ (Etherlink)",
      tokenAddress: undefined as string | undefined, // native
    };
  }, [buyToken]);

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
              {/* USDC Card */}
              <div className="cm-asset-card primary">
                <div className="cm-asset-icon">💲</div>
                <div>
                  <div className="cm-asset-amount">{display.usdc}</div>
                  <div className="cm-asset-name">USDC</div>
                </div>
                <div className="cm-asset-tag">Raffle Funds</div>
              </div>

              {/* XTZ Card */}
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

          {/* ✅ Cashier Tabs */}
          <div className="cm-tabs">
            <button className={`cm-tab ${tab === "buy" ? "active" : ""}`} onClick={() => setTab("buy")}>
              Buy
            </button>
            <button className={`cm-tab ${tab === "swap" ? "active" : ""}`} onClick={() => setTab("swap")}>
              Swap
            </button>
          </div>

          {/* ✅ Buy token switch (only shows in Buy tab) */}
          {tab === "buy" && (
            <div className="cm-subtabs">
              <button
                className={`cm-subtab ${buyToken === "XTZ" ? "active" : ""}`}
                onClick={() => setBuyToken("XTZ")}
              >
                XTZ
              </button>
              <button
                className={`cm-subtab ${buyToken === "USDC" ? "active" : ""}`}
                onClick={() => setBuyToken("USDC")}
              >
                USDC
              </button>
            </div>
          )}

          {/* ✅ Widget Area */}
          <div className="cm-widget-shell">
            {tab === "buy" ? (
              <div className="cm-widget-wrap">
                <BuyWidget
                  // 🔥 CRITICAL: forces widget to reset internal state when token changes
                  key={buyToken}
                  client={thirdwebClient}
                  chain={ETHERLINK_CHAIN}
                  theme="light"
                  title={buyWidgetProps.title}
                  tokenAddress={buyWidgetProps.tokenAddress as any}
                  tokenEditable={false}
                  amountEditable={true}
                  supportedTokens={supportedTokens as any}
                  paymentMethods={["crypto", "card"]}
                  style={{ width: "100%" }}
                />
              </div>
            ) : (
              <div className="cm-widget-wrap">
                <SwapWidget
                  key="swap"
                  client={thirdwebClient}
                  chain={ETHERLINK_CHAIN}
                  theme="light"
                  // Best-effort restriction; varies by widget version
                  supportedTokens={supportedTokens as any}
                  style={{ width: "100%" }}
                />
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="cm-footer-note">
            Tip: Keep a small amount of XTZ for gas fees on Etherlink.
          </div>
        </div>
      </div>
    </div>
  );
}