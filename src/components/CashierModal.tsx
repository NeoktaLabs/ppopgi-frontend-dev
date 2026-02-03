// src/components/CashierModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { getWalletBalance } from "thirdweb/wallets";

// Etherlink USDC
const USDC_ADDRESS = "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9";

type Props = {
  open: boolean;
  onClose: () => void;
};

function fmt(raw: bigint, decimals: number) {
  try {
    return formatUnits(raw, decimals);
  } catch {
    return "0";
  }
}

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function CashierModal({ open, onClose }: Props) {
  const activeAccount = useActiveAccount();
  const me = activeAccount?.address ?? null;

  const [xtz, setXtz] = useState<bigint | null>(null);
  const [usdc, setUsdc] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const usdcContract = useMemo(() => {
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: USDC_ADDRESS,
    });
  }, []);

  const refresh = useCallback(async () => {
    setNote(null);

    if (!me) {
      setXtz(null);
      setUsdc(null);
      setNote("Sign in to see your balances on Etherlink.");
      return;
    }

    setLoading(true);
    try {
      // Native (XTZ): wallet balance on Etherlink
      const b = await getWalletBalance({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: me,
      });

      // ERC20 (USDC): balanceOf
      const u = await readContract({
        contract: usdcContract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [me],
      });

      setXtz(BigInt((b as any).value ?? 0n));
      setUsdc(BigInt(u as any));
    } catch {
      setXtz(null);
      setUsdc(null);
      setNote("Could not load balances right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [me, usdcContract]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  if (!open) return null;

  // ----------------- STYLE (Ppopgi glass) -----------------
  const ink = "#4A0F2B";

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.40)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  const modal: React.CSSProperties = {
    width: "min(860px, 100%)",
    maxHeight: "min(88vh, 900px)",
    overflow: "hidden",
    borderRadius: 22,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.40))," +
      "radial-gradient(900px 260px at 15% 0%, rgba(255,141,187,0.18), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 260px at 85% 0%, rgba(203,183,246,0.18), rgba(203,183,246,0) 55%)",
    border: "1px solid rgba(255,255,255,0.70)",
    boxShadow: "0 22px 70px rgba(0,0,0,0.28)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: ink,
  };

  const header: React.CSSProperties = {
    padding: 16,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  };

  const title: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    fontWeight: 1000,
    letterSpacing: 0.2,
  };

  const subtitle: React.CSSProperties = {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.82,
    lineHeight: 1.4,
  };

  const body: React.CSSProperties = {
    padding: 14,
    overflow: "auto",
    maxHeight: "calc(min(88vh, 900px) - 72px)",
    display: "grid",
    gap: 12,
  };

  const panel: React.CSSProperties = {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.62)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
  };

  const rowBetween: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "7px 10px",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
    color: ink,
  };

  const btnBase: React.CSSProperties = {
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 1000,
    cursor: "pointer",
    border: "1px solid rgba(0,0,0,0.10)",
    whiteSpace: "nowrap",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "rgba(25,25,35,0.92)",
    color: "white",
  };

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: "rgba(255,255,255,0.86)",
    color: ink,
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    background: "rgba(240,240,242,1)",
    color: "rgba(20,20,28,0.45)",
    cursor: "not-allowed",
  };

  const bigAmount: React.CSSProperties = {
    marginTop: 6,
    fontSize: 26,
    fontWeight: 1100 as any,
    letterSpacing: 0.2,
    color: ink,
    lineHeight: 1.05,
  };

  const smallLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 950,
    opacity: 0.85,
  };

  const hint: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.82,
    lineHeight: 1.35,
  };

  const noteBox: React.CSSProperties = {
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.80)",
    border: "1px solid rgba(0,0,0,0.08)",
    fontSize: 13,
    fontWeight: 900,
    boxShadow: "0 14px 26px rgba(0,0,0,0.10)",
  };

  const xtzText = xtz === null ? "—" : `${fmt(xtz, 18)} XTZ`;
  const usdcText = usdc === null ? "—" : `${fmt(usdc, 6)} USDC`;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div style={header}>
          <div>
            <div style={{ ...smallLabel, opacity: 0.75 }}>Cashier</div>
            <h3 style={title}>Balances & getting started</h3>
            <div style={subtitle}>
              Read-only view of your balances on Etherlink. You always confirm actions in your wallet.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={chip} title={me || ""}>
              <span style={{ opacity: 0.85 }}>Account</span>
              <b style={{ letterSpacing: 0.2 }}>{me ? short(me) : "Not signed in"}</b>
            </span>

            <button style={!loading ? btnPrimary : btnDisabled} onClick={refresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            <button style={btnSecondary} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div style={body}>
          {note && <div style={noteBox}>{note}</div>}

          {/* Balance summary */}
          <div style={panel}>
            <div style={rowBetween}>
              <div style={{ fontWeight: 1100 as any, letterSpacing: 0.2 }}>Your balances</div>
              <span style={chip}>{loading ? "Syncing…" : "Up to date"}</span>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(255,255,255,0.62)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <div style={smallLabel}>XTZ (gas)</div>
                <div style={bigAmount}>{xtzText}</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78 }}>
                  Needed for gas even if you only use USDC.
                </div>
              </div>

              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(255,255,255,0.62)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <div style={smallLabel}>USDC</div>
                <div style={bigAmount}>{usdcText}</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78 }}>
                  Used to buy tickets and fund prizes.
                </div>
              </div>
            </div>

            <div style={hint}>
              If you see “—”, sign in and make sure your wallet is connected to Etherlink.
            </div>
          </div>

          {/* Getting started */}
          <div style={panel}>
            <div style={{ fontWeight: 1100 as any, letterSpacing: 0.2 }}>Getting started</div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(255,255,255,0.62)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 1000 }}>1) Get a little XTZ</div>
                <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
                  You’ll need XTZ for gas to create raffles and buy tickets.
                </div>
              </div>

              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(255,255,255,0.62)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 1000 }}>2) Move funds to Etherlink</div>
                <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
                  Bridge or use a supported route that lands on Etherlink.
                </div>
              </div>

              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(255,255,255,0.62)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 1000 }}>3) Get USDC on Etherlink</div>
                <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
                  Bridge or swap to USDC on Etherlink, then come back and join raffles.
                </div>
              </div>
            </div>

            <div style={hint}>
              This modal is purely informational — it never triggers transactions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}