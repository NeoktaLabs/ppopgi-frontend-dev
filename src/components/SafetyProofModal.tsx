// src/components/SafetyProofModal.tsx
import React, { useMemo } from "react";
import { formatUnits } from "ethers";
import type { RaffleDetails } from "../hooks/useRaffleDetails";

type Props = {
  open: boolean;
  onClose: () => void;
  raffle: RaffleDetails;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function statusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

function safeBigInt(x: string) {
  try {
    return BigInt(x);
  } catch {
    return 0n;
  }
}

function fmtUsdcRaw(raw: bigint) {
  try {
    return formatUnits(raw, 6);
  } catch {
    return "0";
  }
}

export function SafetyProofModal({ open, onClose, raffle }: Props) {
  const breakdown = useMemo(() => {
    const revenue = safeBigInt(raffle.ticketRevenue ?? "0");
    const pot = safeBigInt(raffle.winningPot ?? "0");
    const pct = safeBigInt(raffle.protocolFeePercent ?? "0");

    // fee = revenue * pct / 100
    const fee = (revenue * pct) / 100n;

    // creator share "so far" = revenue - pot - fee (clamp to 0)
    let creatorSoFar = revenue - pot - fee;
    if (creatorSoFar < 0n) creatorSoFar = 0n;

    return { revenue, pot, pct, fee, creatorSoFar };
  }, [raffle]);

  if (!open) return null;

  const isDrawing = raffle.status === "DRAWING";

  // ───────────── Safety (blue) palette ─────────────
  const ink = "#0B2E5C";
  const inkStrong = "#071E3D";

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 11000,
  };

  const card: React.CSSProperties = {
    position: "relative",
    width: "min(720px, 100%)",
    maxHeight: "min(86vh, 920px)",
    overflow: "auto",
    borderRadius: 22,
    padding: 18,
    userSelect: "none",
    background:
      // blue glass ticket (similar richness to raffle card)
      "radial-gradient(900px 520px at 20% 10%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)," +
      "radial-gradient(900px 520px at 80% 0%, rgba(169,212,255,0.28), rgba(169,212,255,0) 62%)," +
      "linear-gradient(180deg, rgba(169,212,255,0.55), rgba(232,246,255,0.38) 45%, rgba(255,255,255,0.38))",
    border: "1px solid rgba(255,255,255,0.78)",
    boxShadow: "0 22px 46px rgba(0,0,0,0.18)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  };

  const notch: React.CSSProperties = {
    position: "absolute",
    top: "52%",
    transform: "translateY(-50%)",
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "rgba(255,255,255,0.62)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.14)",
    pointerEvents: "none",
  };

  const tearLine: React.CSSProperties = {
    marginTop: 14,
    height: 1,
    background:
      "repeating-linear-gradient(90deg, rgba(60,130,246,0.55), rgba(60,130,246,0.55) 7px," +
      " rgba(0,0,0,0) 7px, rgba(0,0,0,0) 14px)",
    opacity: 0.8,
    pointerEvents: "none",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  };

  const badge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.86)",
    border: "1px solid rgba(0,0,0,0.10)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
    color: inkStrong,
    fontWeight: 1000,
    letterSpacing: 0.25,
    fontSize: 14,
    whiteSpace: "nowrap",
  };

  const closeBtn: React.CSSProperties = {
    borderRadius: 12,
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(0,0,0,0.08)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    padding: "8px 10px",
    fontWeight: 950,
    color: inkStrong,
  };

  const titleWrap: React.CSSProperties = { marginTop: 8, textAlign: "center" };

  const smallKicker: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.92,
    color: ink,
    letterSpacing: 0.2,
  };

  const titleText: React.CSSProperties = {
    marginTop: 4,
    fontSize: 22,
    fontWeight: 1000 as any,
    letterSpacing: 0.1,
    lineHeight: 1.15,
    color: inkStrong,
  };

  const subText: React.CSSProperties = {
    marginTop: 10,
    fontSize: 13,
    opacity: 0.92,
    color: ink,
    lineHeight: 1.35,
  };

  const section: React.CSSProperties = { marginTop: 12 };

  const panel: React.CSSProperties = {
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
    display: "grid",
    gap: 8,
  };

  const panelTitle: React.CSSProperties = {
    fontWeight: 1000,
    color: inkStrong,
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 2,
  };

  const label: React.CSSProperties = { opacity: 0.85, color: ink };
  const value: React.CSSProperties = { fontWeight: 950, color: inkStrong, textAlign: "right" as const };

  const helper: React.CSSProperties = { marginTop: 2, fontSize: 12, opacity: 0.9, color: ink, lineHeight: 1.35 };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Ticket notches */}
        <div style={{ ...notch, left: -9 }} />
        <div style={{ ...notch, right: -9 }} />

        <div style={topRow}>
          <div style={badge} title="Safety proof">
            {/* shield icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4Z"
                stroke={inkStrong}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M9.2 12.2l1.8 1.9 3.8-4"
                stroke={inkStrong}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            </svg>
            Safety proof
          </div>

          <button onClick={onClose} style={closeBtn} title="Close">
            Close
          </button>
        </div>

        <div style={titleWrap}>
          <div style={smallKicker}>These values come from the network</div>
          <div style={titleText}>Safety info</div>
          <div style={subText}>
            The app only reads contract state and prepares transactions for you to confirm. Nothing here can be edited by
            the app.
          </div>
        </div>

        <div style={tearLine} />

        {/* STATUS */}
        <div style={section}>
          <div style={panel}>
            <div style={panelTitle}>Status</div>

            <div style={row}>
              <div style={label}>State</div>
              <div style={value}>{statusLabel(raffle.status)}</div>
            </div>

            <div style={row}>
              <div style={label}>Raffle address</div>
              <div style={value}>{short(raffle.address)}</div>
            </div>

            <div style={row}>
              <div style={label}>USDC token</div>
              <div style={value}>{short(raffle.usdcToken)}</div>
            </div>
          </div>
        </div>

        {/* WHO GETS WHAT */}
        <div style={section}>
          <div style={panel}>
            <div style={panelTitle}>Who gets what</div>

            <div style={row}>
              <div style={label}>Winner gets</div>
              <div style={value}>{fmtUsdcRaw(safeBigInt(raffle.winningPot))} USDC</div>
            </div>

            <div style={row}>
              <div style={label}>Ppopgi fee</div>
              <div style={value}>
                {fmtUsdcRaw(breakdown.fee)} USDC ({raffle.protocolFeePercent}%)
              </div>
            </div>

            <div style={row}>
              <div style={label}>Fee receiver</div>
              <div style={value}>{short(raffle.feeRecipient)}</div>
            </div>

            <div style={row}>
              <div style={label}>Creator gets (so far)</div>
              <div style={value}>{fmtUsdcRaw(breakdown.creatorSoFar)} USDC</div>
            </div>

            <div style={helper}>“So far” means based on tickets sold up to now.</div>
          </div>
        </div>

        {/* HOW THE DRAW WORKS */}
        <div style={section}>
          <div style={panel}>
            <div style={panelTitle}>How the draw works</div>

            <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.92, color: ink }}>
              When time ends (or tickets sell out), anyone can start the draw. A randomness service is asked for a random
              number. A winner is shown only after the randomness result arrives.
            </div>

            <div style={row}>
              <div style={label}>Randomness provider</div>
              <div style={value}>{short(raffle.entropyProvider)}</div>
            </div>

            {isDrawing && (
              <>
                <div style={row}>
                  <div style={label}>Request id</div>
                  <div style={value}>{raffle.entropyRequestId ?? "—"}</div>
                </div>
                <div style={row}>
                  <div style={label}>Provider used</div>
                  <div style={value}>{short(raffle.selectedProvider ?? "—")}</div>
                </div>
              </>
            )}

            <div style={helper}>If the randomness result never comes back, there is an on-chain recovery path.</div>
          </div>
        </div>

        {/* WHAT THE APP CANNOT DO */}
        <div style={section}>
          <div style={panel}>
            <div style={panelTitle}>What the app cannot do</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.45, color: ink }}>
              <li>The app cannot choose the winner.</li>
              <li>The app cannot change rules after the raffle is created.</li>
              <li>The app cannot take prizes or refunds once they are owed.</li>
              <li>Anyone can start the draw — it does not depend on one operator.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}