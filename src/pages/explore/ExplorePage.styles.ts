import type { CSSProperties } from "react";

export function createExploreStyles(ink: string) {
  const wrap: CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))," +
      "radial-gradient(900px 240px at 10% 0%, rgba(255,141,187,0.10), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 240px at 90% 0%, rgba(203,183,246,0.10), rgba(203,183,246,0) 55%)",
    backdropFilter: "blur(3px)",
    border: "2px solid rgba(255,255,255,0.55)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
  };

  const innerStroke: CSSProperties = {
    position: "absolute",
    inset: 6,
    borderRadius: 20,
    pointerEvents: "none",
    border: "1px solid rgba(242,166,198,0.55)",
  };

  const accent: CSSProperties = {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 12,
    width: 6,
    borderRadius: 999,
    background: "linear-gradient(180deg, #FF8DBB, #CBB7F6, #FFD89A)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  };

  // --- Hero
  const hero: CSSProperties = {
    paddingLeft: 18,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const heroTitlePill: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 1000 as any,
    fontSize: 16,
    letterSpacing: 0.25,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: ink,
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const heroDot: CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "linear-gradient(135deg, rgba(255,141,187,0.95), rgba(203,183,246,0.95))",
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
  };

  const heroMeta: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(0,0,0,0.10)",
    fontWeight: 950,
    color: ink,
    whiteSpace: "nowrap",
  };

  const subNote: CSSProperties = {
    marginTop: 10,
    paddingLeft: 18,
    fontSize: 13,
    fontWeight: 850,
    opacity: 0.95,
    color: ink,
  };

  // --- Controls
  const controls: CSSProperties = {
    marginTop: 14,
    paddingLeft: 18,
    display: "grid",
    gap: 12,
  };

  const panel: CSSProperties = {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
  };

  const panelTitle: CSSProperties = {
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    opacity: 0.9,
    color: ink,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const row: CSSProperties = {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr",
    gap: 10,
  };

  const row2: CSSProperties = {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };

  const label: CSSProperties = {
    fontSize: 12,
    fontWeight: 950,
    opacity: 0.9,
    color: ink,
    marginBottom: 6,
  };

  const input: CSSProperties = {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.86)",
    borderRadius: 14,
    padding: "11px 12px",
    outline: "none",
    color: "rgba(20,20,28,0.92)",
    fontWeight: 850,
  };

  const selectStyle: CSSProperties = {
    ...input,
    cursor: "pointer",
  };

  const pill: CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 999,
    padding: "10px 12px",
    cursor: "pointer",
    color: ink,
    fontWeight: 950,
    fontSize: 13,
    whiteSpace: "nowrap",
  };

  const pillOn: CSSProperties = {
    ...pill,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const pillDisabled: CSSProperties = {
    ...pill,
    opacity: 0.55,
    cursor: "not-allowed",
  };

  const miniBtn: CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 950,
    color: ink,
    whiteSpace: "nowrap",
  };

  const miniBtnPrimary: CSSProperties = {
    ...miniBtn,
    background: "rgba(25,25,35,0.92)",
    color: "white",
  };

  const resultsWrap: CSSProperties = {
    marginTop: 14,
    paddingLeft: 18,
    display: "grid",
    gap: 10,
  };

  const resultsHeader: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const resultsPill: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.78)",
    fontWeight: 950,
    fontSize: 12,
    color: ink,
  };

  const emptyCard: CSSProperties = {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: ink,
    fontWeight: 900,
    opacity: 0.95,
  };

  return {
    wrap, innerStroke, accent, hero, heroTitlePill, heroDot, heroMeta, subNote, controls, panel, panelTitle, row, row2, label, input, selectStyle, pill, pillOn, pillDisabled, miniBtn, miniBtnPrimary, resultsWrap, resultsHeader, resultsPill, emptyCard,
  };
}
