import type { CSSProperties } from "react";

type StatusTheme = { bg: string; fg: string; border: string };

export function createRaffleDetailsModalStyles(status: StatusTheme) {
  const overlay: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  const ink = "#5C1F3B";
  const inkStrong = "#4A0F2B";

  const card: CSSProperties = {
    position: "relative",
    width: "min(780px, 100%)",
    maxHeight: "min(86vh, 920px)",
    overflow: "auto",
    borderRadius: 22,
    padding: 18,
    userSelect: "none",
    background:
      "linear-gradient(180deg, rgba(255,190,215,0.92), rgba(255,210,230,0.78) 42%, rgba(255,235,246,0.82))",
    border: "1px solid rgba(255,255,255,0.78)",
    boxShadow: "0 22px 46px rgba(0,0,0,0.18)",
    backdropFilter: "blur(14px)",
  };

  const notch: CSSProperties = {
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

  const tearLine: CSSProperties = {
    marginTop: 14,
    height: 1,
    background:
      "repeating-linear-gradient(90deg, rgba(180,70,120,0.62), rgba(180,70,120,0.62) 7px," +
      " rgba(0,0,0,0) 7px, rgba(0,0,0,0) 14px)",
    opacity: 0.8,
    pointerEvents: "none",
  };

  const topRow: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  };

  const statusChip: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.35,
    whiteSpace: "nowrap",
    background: status.bg,
    color: status.fg,
    border: status.border,
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const miniBtn: CSSProperties = {
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

  const miniBtnDisabled: CSSProperties = { ...miniBtn, cursor: "not-allowed", opacity: 0.6 };

  const copyToast: CSSProperties = {
    position: "absolute",
    top: 54,
    left: 12,
    right: 12,
    padding: "8px 10px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.90)",
    border: "1px solid rgba(0,0,0,0.08)",
    color: inkStrong,
    fontSize: 12,
    fontWeight: 950,
    textAlign: "center",
    boxShadow: "0 14px 26px rgba(0,0,0,0.12)",
    pointerEvents: "none",
  };

  const titleWrap: CSSProperties = { marginTop: 8, textAlign: "center" };
  const smallKicker: CSSProperties = { fontSize: 12, fontWeight: 800, opacity: 0.9, color: ink };
  const titleText: CSSProperties = {
    marginTop: 4,
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: 0.1,
    lineHeight: 1.15,
    color: inkStrong,
  };
  const prizeKicker: CSSProperties = { marginTop: 4, fontSize: 12, fontWeight: 950, opacity: 0.9, color: ink };
  const prizeValue: CSSProperties = { marginTop: 2, fontSize: 22, fontWeight: 1000, color: inkStrong };

  const grid2: CSSProperties = { marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
  const grid3: CSSProperties = { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 };

  const mini: CSSProperties = {
    borderRadius: 16,
    padding: "12px 12px",
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
    display: "grid",
    gap: 6,
  };
  const miniLabel: CSSProperties = { fontSize: 12, fontWeight: 900, opacity: 0.85, color: ink };
  const miniValue: CSSProperties = { fontSize: 14, fontWeight: 1000, color: inkStrong, lineHeight: 1.15 };

  const hint: CSSProperties = { marginTop: 10, fontSize: 12, opacity: 0.88, color: inkStrong, lineHeight: 1.35 };

  const section: CSSProperties = {
    marginTop: 14,
    borderRadius: 18,
    padding: 12,
    background: "rgba(255,255,255,0.52)",
    border: "1px solid rgba(0,0,0,0.06)",
    display: "grid",
    gap: 10,
  };

  const panel: CSSProperties = { display: "grid", gap: 8 };
  const row: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10 };
  const label: CSSProperties = { fontSize: 12, fontWeight: 900, opacity: 0.8, color: ink };
  const value: CSSProperties = { fontSize: 12, fontWeight: 1000, color: inkStrong, textAlign: "right" };

  const input: CSSProperties = {
    width: "100%",
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.84)",
    fontSize: 14,
    fontWeight: 900,
    color: inkStrong,
  };

  const btn: CSSProperties = {
    width: "100%",
    borderRadius: 14,
    padding: "12px 12px",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.84)",
    fontSize: 14,
    fontWeight: 1000,
    cursor: "pointer",
    color: inkStrong,
  };
  const btnDisabled: CSSProperties = { ...btn, cursor: "not-allowed", opacity: 0.55 };
  const btnEnabled: CSSProperties = { ...btn, background: "linear-gradient(180deg, rgba(255,120,140,0.95), rgba(255,170,185,0.92))", color: "#5A0012" };

  const bottomRow: CSSProperties = { marginTop: 14, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
  const bottomText: CSSProperties = { fontSize: 14, fontWeight: 950, color: inkStrong, letterSpacing: 0.2 };

  return {
    overlay,
    card,
    notch,
    tearLine,
    topRow,
    statusChip,
    miniBtn,
    miniBtnDisabled,
    copyToast,
    titleWrap,
    smallKicker,
    titleText,
    prizeKicker,
    prizeValue,
    grid2,
    grid3,
    mini,
    miniLabel,
    miniValue,
    hint,
    section,
    panel,
    row,
    label,
    value,
    input,
    btn,
    btnDisabled,
    btnEnabled,
    bottomRow,
    bottomText,
    ink,
    inkStrong,
  };
}
