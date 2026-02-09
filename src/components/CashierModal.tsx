// src/components/CashierModal.tsx
import { useMemo, useState } from "react";
import { useCashierData } from "../hooks/useCashierData";
import "./CashierModal.css";

// thirdweb widgets
import { BuyWidget, SwapWidget } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type Props = {
  open: boolean;
  onClose: () => void;
};

// Etherlink
const ETHERLINK_ID = ETHERLINK_CHAIN.id; // should be 42793 in your logs
const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

// Your USDC on Etherlink (from your Oku link)
const USDC_ETHERLINK = "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9";

type Tab = "buy" | "swap";
type BuyToken = "USDC" | "XTZ";

export function CashierModal({ open, onClose }: Props) {
  const { state, actions, display } = useCashierData(open);
  const [copied, setCopied] = useState(false);

  const [tab, setTab] = useState<Tab>("buy");
  const [buyToken, setBuyToken] = useState<BuyToken>("USDC");

  const handleCopy = () => {
    if (state.me) {
      navigator.clipboard.writeText(state.me);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const supportedTokens = useMemo(() => {
    // Restrict "pay with" tokens inside BuyWidget
    // (Token list is per-chainId)  [oai_citation:2‡thirdweb docs](https://portal.thirdweb.com/references/typescript/v5/BuyWidget)
    return {
      [ETHERLINK_ID]: [
        { address: USDC_ETHERLINK, name: "USDC", symbol: "USDC" },
        { address: NATIVE_TOKEN_ADDRESS, name: "Tezos", symbol: "XTZ" },
      ],
    } as any;
  }, []);

  const buyWidgetProps = useMemo(() => {
    // BuyWidget forces Etherlink + chosen token, and we lock the token picker.
    // tokenAddress/tokenEditable are supported props.  [oai_citation:3‡thirdweb docs](https://portal.thirdweb.com/references/typescript/v5/BuyWidget)
    if (buyToken === "USDC") {
      return {
        title: "Buy USDC (Etherlink)",
        amount: "25",
        tokenAddress: USDC_ETHERLINK,
      };
    }
    return {
      title: "Buy XTZ (Etherlink)",
      amount: "10",
      // native token: omit tokenAddress (widget interprets `amount` as native)
      tokenAddress: undefined,
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

          {/* Widgets Section */}
          <div className="cm-widgets">
            <div className="cm-section-label">Cashier</div>

            {/* Tabs */}
            <div className="cm-tabs">
              <button className={`cm-tab ${tab === "buy" ? "active" : ""}`} onClick={() => setTab("buy")}>
                Buy
              </button>
              <button className={`cm-tab ${tab === "swap" ? "active" : ""}`} onClick={() => setTab("swap")}>
                Swap
              </button>
            </div>

            {/* Tab contents */}
            {tab === "buy" && (
              <>
                <div className="cm-mini-toggle">
                  <button
                    className={`cm-mini-btn ${buyToken === "USDC" ? "active" : ""}`}
                    onClick={() => setBuyToken("USDC")}
                  >
                    USDC
                  </button>
                  <button
                    className={`cm-mini-btn ${buyToken === "XTZ" ? "active" : ""}`}
                    onClick={() => setBuyToken("XTZ")}
                  >
                    XTZ
                  </button>
                </div>

                <div className="cm-widget-wrap">
                  <BuyWidget
                    client={thirdwebClient}
                    chain={ETHERLINK_CHAIN}
                    title={buyWidgetProps.title}
                    amount={buyWidgetProps.amount}
                    tokenAddress={buyWidgetProps.tokenAddress as any}
                    tokenEditable={false}
                    amountEditable={true}
                    supportedTokens={supportedTokens}
                    paymentMethods={["crypto", "card"]}
                    theme="light"
                    style={{ width: "100%" }}
                  />
                </div>

                <div className="cm-widget-hint">
                  You’re on <b>Etherlink</b>. Buying is limited to <b>USDC</b> or <b>XTZ</b>.
                </div>
              </>
            )}

            {tab === "swap" && (
              <>
                <div className="cm-widget-wrap">
                  <SwapWidget
                    client={thirdwebClient}
                    chain={ETHERLINK_CHAIN}
                    theme="light"
                    style={{ width: "100%" }}
                    // Prefill XTZ -> USDC (users may still be able to change tokens depending on widget UI)  [oai_citation:4‡thirdweb docs](https://portal.thirdweb.com/references/typescript/v5/SwapWidget)
                    fromToken={{ chainId: ETHERLINK_ID, tokenAddress: NATIVE_TOKEN_ADDRESS } as any}
                    toToken={{ chainId: ETHERLINK_ID, tokenAddress: USDC_ETHERLINK } as any}
                    persistTokenSelections={false}
                  />
                </div>

                <div className="cm-widget-hint">
                  Prefilled to swap <b>XTZ ⇄ USDC</b> on <b>Etherlink</b>.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}