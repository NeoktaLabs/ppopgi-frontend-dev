import type { CSSProperties } from "react";

type Params = {
  s: (n: number) => number;
  isHover: boolean;
  foil: null | { bg: string; ink: string; inkStrong: string; tear: string };
  status: any;
  ink: string;
  inkStrong: string;
  onOpenSafety?: (id: string) => void;
  displayStatus: string;
  hatch?: any;
};

export function createRaffleCardStyles(params: Params) {
  const { s, isHover, foil, status, ink, inkStrong, onOpenSafety, hatch } = params;

    const card: CSSProperties = {
      position: "relative",
      width: "100%",
      maxWidth: s(340),
      borderRadius: s(22),
      padding: s(16),
      cursor: "pointer",
      userSelect: "none",
      overflow: "hidden",
      background:
        foil?.bg ??
        "linear-gradient(180deg, rgba(255,190,215,0.92), rgba(255,210,230,0.78) 42%, rgba(255,235,246,0.82))",
      border: "1px solid rgba(255,255,255,0.78)",
      boxShadow: isHover ? "0 22px 46px rgba(0,0,0,0.18)" : "0 16px 34px rgba(0,0,0,0.14)",
      WebkitBackfaceVisibility: "hidden",
      backfaceVisibility: "hidden",
      willChange: "transform",
      transform: isHover ? "translate3d(0,-3px,0)" : "translate3d(0,0,0)",
      transition: "transform 140ms ease, box-shadow 140ms ease",
      backdropFilter: "blur(10px)",
    };
  
    const notch: CSSProperties = {
      position: "absolute",
      top: "52%",
      transform: "translateY(-50%)",
      width: s(18),
      height: s(18),
      borderRadius: 999,
      background: "rgba(255,255,255,0.62)",
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.14)",
      pointerEvents: "none",
    };
  
    const tearLine: CSSProperties = {
      marginTop: s(14),
      height: 1,
      background:
        "repeating-linear-gradient(90deg, " +
        `${foil?.tear ?? "rgba(180,70,120,0.62)"} , ${foil?.tear ?? "rgba(180,70,120,0.62)"} 7px,` +
        " rgba(0,0,0,0) 7px, rgba(0,0,0,0) 14px)",
      opacity: 0.8,
      pointerEvents: "none",
    };
  
    const topRow: CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: s(10),
    };
  
    const statusChip: CSSProperties = {
      padding: `${s(6)}px ${s(10)}px`,
      borderRadius: 999,
      fontSize: s(12),
      fontWeight: 950,
      letterSpacing: 0.35,
      whiteSpace: "nowrap",
      background: status.bg,
      color: status.fg,
      border: status.border,
      boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
    };
  
    const shareBtn: CSSProperties = {
      width: s(34),
      height: s(34),
      borderRadius: s(12),
      background: "rgba(255,255,255,0.82)",
      border: "1px solid rgba(0,0,0,0.08)",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
    };
  
    const safetyBtn: CSSProperties = {
      width: s(34),
      height: s(34),
      borderRadius: s(12),
      display: "grid",
      placeItems: "center",
      cursor: onOpenSafety ? "pointer" : "not-allowed",
      opacity: onOpenSafety ? 1 : 0.55,
      background:
        "linear-gradient(180deg, rgba(235,245,255,0.92), rgba(214,235,255,0.80))," +
        "radial-gradient(120px 60px at 30% 25%, rgba(255,255,255,0.70), rgba(255,255,255,0) 60%)",
      border: "1px solid rgba(0,0,0,0.10)",
      boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
    };
  
    const copyToast: CSSProperties = {
      position: "absolute",
      top: s(44),
      left: s(12),
      right: s(12),
      padding: `${s(8)}px ${s(10)}px`,
      borderRadius: s(14),
      background: "rgba(255,255,255,0.90)",
      border: "1px solid rgba(0,0,0,0.08)",
      color: inkStrong,
      fontSize: s(12),
      fontWeight: 950,
      textAlign: "center",
      boxShadow: "0 14px 26px rgba(0,0,0,0.12)",
      pointerEvents: "none",
    };
  
    const titleWrap: CSSProperties = { marginTop: s(10), textAlign: "center" };
  
    const smallKicker: CSSProperties = {
      fontSize: s(12),
      fontWeight: 800,
      opacity: 0.9,
      color: ink,
    };
  
    const titleText: CSSProperties = {
      marginTop: s(4),
      fontSize: s(18),
      fontWeight: 950,
      letterSpacing: 0.1,
      lineHeight: 1.15,
      color: inkStrong,
    };
  
    const prizeKicker: CSSProperties = {
      marginTop: s(14),
      fontSize: s(12),
      fontWeight: 950,
      letterSpacing: 0.45,
      textTransform: "uppercase",
      opacity: 0.92,
      color: ink,
      textAlign: "center",
    };
  
    const prizeValue: CSSProperties = {
      marginTop: s(8),
      fontSize: s(34),
      fontWeight: 1000 as any,
      lineHeight: 1.0,
      letterSpacing: 0.2,
      textAlign: "center",
      color: inkStrong,
      textShadow: "0 1px 0 rgba(255,255,255,0.35)",
    };
  
    const midGrid: CSSProperties = {
      marginTop: s(16),
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: s(12),
    };
  
    const mini: CSSProperties = {
      borderRadius: s(14),
      padding: s(12),
      background: "rgba(255,255,255,0.56)",
      border: "1px solid rgba(0,0,0,0.06)",
    };
  
    const miniLabel: CSSProperties = {
      fontSize: s(12),
      fontWeight: 950,
      letterSpacing: 0.25,
      opacity: 0.9,
      color: ink,
    };
  
    const miniValue: CSSProperties = {
      marginTop: s(6),
      fontSize: s(14),
      fontWeight: 950,
      color: inkStrong,
    };
  
    const hint: CSSProperties = {
      marginTop: s(4),
      fontSize: s(11),
      fontWeight: 800,
      opacity: 0.88,
      color: ink,
    };
  
    const blockSlot: CSSProperties = { marginTop: s(12), minHeight: s(86) };
  
    const barWrap: CSSProperties = { display: "grid", gap: s(8) };
  
    const barLabelRow: CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: s(10),
    };
  
    const barTrack: CSSProperties = {
      height: s(10),
      borderRadius: 999,
      background: "rgba(0,0,0,0.10)",
      overflow: "hidden",
      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.10)",
    };
  
    const barFillBase: CSSProperties = { height: "100%", borderRadius: 999, transition: "width 220ms ease" };
  
    const barFillPending: CSSProperties = {
      ...barFillBase,
      background: "linear-gradient(90deg, rgba(59,130,246,0.95), rgba(169,212,255,0.95))",
    };
  
    const barFillMin: CSSProperties = {
      ...barFillBase,
      background: "linear-gradient(90deg, rgba(34,197,94,0.95), rgba(145,247,184,0.95))",
    };
  
    const barFillMax: CSSProperties = {
      ...barFillBase,
      background: "linear-gradient(90deg, rgba(168,85,247,0.95), rgba(203,183,246,0.95))",
    };
  
    const barFillInfinite: CSSProperties = {
      ...barFillBase,
      width: "100%",
      background:
        "repeating-linear-gradient(45deg, rgba(168,85,247,0.95), rgba(168,85,247,0.95) 10px, rgba(168,85,247,0.55) 10px, rgba(168,85,247,0.55) 20px)",
      opacity: 0.85,
    };
  
    const smallHint: CSSProperties = {
      fontSize: s(11),
      fontWeight: 900,
      color: ink,
      opacity: 0.92,
    };
  
    const pastBlock: CSSProperties = {
      borderRadius: s(14),
      padding: s(12),
      background: "rgba(255,255,255,0.56)",
      border: "1px solid rgba(0,0,0,0.06)",
      display: "grid",
      gap: s(6),
    };
  
    const pastLine1: CSSProperties = { fontSize: s(12), fontWeight: 950, color: inkStrong, lineHeight: 1.25 };
    const pastLine2: CSSProperties = {
      fontSize: s(12),
      fontWeight: 900,
      color: ink,
      opacity: 0.92,
      lineHeight: 1.25,
    };
  
    const bottomRow: CSSProperties = {
      marginTop: s(14),
      paddingTop: s(12),
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: s(10),
    };
  
    const bottomText: CSSProperties = { fontSize: s(14), fontWeight: 950, color: inkStrong, letterSpacing: 0.2 }; 
  
    // ✅ integrated hatch UI (inside card)
    // IMPORTANT: if Dashboard passes null, hatch is hidden and we avoid TS union issues. 
  
    const hatchWrap: CSSProperties = {
      marginTop: s(10),
      borderRadius: s(14),
      padding: s(10),
      border: "1px solid rgba(0,0,0,0.06)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.64), rgba(255,255,255,0.44))," +
        "radial-gradient(240px 120px at 20% 30%, rgba(255,120,140,0.14), rgba(255,120,140,0) 60%)",
      display: "grid",
      gap: s(8),
    };
  
    const hatchTop: CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: s(10),
    };
  
    const hatchTitle: CSSProperties = {
      fontSize: s(12),
      fontWeight: 1000,
      color: inkStrong,
      letterSpacing: 0.2,
    };
  
    const hatchLabel: CSSProperties = {
      fontSize: s(11),
      fontWeight: 900,
      color: ink,
      opacity: 0.95,
      textAlign: "right",
    };
  
    const hatchBtn: CSSProperties = {
      width: "100%",
      borderRadius: s(12),
      padding: `${s(10)}px ${s(10)}px`,
      border: "1px solid rgba(0,0,0,0.10)",
      background: hatch?.ready
        ? "linear-gradient(180deg, rgba(255,120,140,0.95), rgba(255,170,185,0.92))"
        : "rgba(255,255,255,0.76)",
      color: hatch?.ready ? "#5A0012" : inkStrong,
      fontWeight: 1000,
      cursor: hatch?.disabled || hatch?.busy ? "not-allowed" : hatch?.ready ? "pointer" : "not-allowed",
      opacity: hatch?.disabled || hatch?.busy ? 0.65 : 1,
    };
  
    const hatchNote: CSSProperties = {
      fontSize: s(11),
      fontWeight: 900,
      color: inkStrong,
      opacity: 0.92,
      lineHeight: 1.25,
    };

  return {
    card, notch, tearLine, topRow, statusChip, shareBtn, safetyBtn, copyToast, titleWrap, smallKicker, titleText, prizeKicker, prizeValue, midGrid, mini, miniLabel, miniValue, hint, blockSlot, barWrap, barLabelRow, barTrack, barFillBase, barFillPending, barFillMin, barFillMax, barFillInfinite, smallHint, pastBlock, pastLine1, pastLine2, bottomRow, bottomText, hatchWrap, hatchTop, hatchTitle, hatchLabel, hatchBtn, hatchNote,
  };
}
