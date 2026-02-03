import type { CSSProperties } from "react";

export function createCreateRaffleModalStyles() {
    const overlay: CSSProperties = {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 10500,
    };
  
    // Light modal (no glass)
    const modal: CSSProperties = {
      width: "min(980px, 100%)",
      maxHeight: "min(88vh, 860px)",
      overflow: "hidden",
      borderRadius: 20,
      border: "1px solid rgba(0,0,0,0.08)",
      background: "rgba(255,255,255,0.96)",
      boxShadow: "0 20px 70px rgba(0,0,0,0.30)",
      color: "rgba(20,20,28,0.92)",
    };
  
    const header: CSSProperties = {
      padding: 18,
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    };
  
    const title: CSSProperties = {
      margin: 0,
      fontSize: 18,
      fontWeight: 950,
      letterSpacing: 0.2,
    };
  
    const subtitle: CSSProperties = {
      marginTop: 6,
      fontSize: 13,
      opacity: 0.75,
      lineHeight: 1.4,
    };
  
    const closeBtn: CSSProperties = {
      border: "1px solid rgba(0,0,0,0.10)",
      background: "rgba(255,255,255,0.90)",
      borderRadius: 12,
      padding: "10px 12px",
      cursor: "pointer",
      fontWeight: 900,
    };
  
    const body: CSSProperties = {
      display: "grid",
      gridTemplateColumns: "1.05fr 0.95fr",
      gap: 14,
      padding: 14,
      overflow: "auto",
      maxHeight: "calc(min(88vh, 860px) - 78px)",
    };
  
    const sectionBase: CSSProperties = {
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,0.06)",
      padding: 14,
    };
  
    const secA: CSSProperties = { ...sectionBase, background: "rgba(245,247,255,0.9)" };
    const secB: CSSProperties = { ...sectionBase, background: "rgba(245,255,248,0.9)" };
    const secC: CSSProperties = { ...sectionBase, background: "rgba(255,248,245,0.9)" };
    const secD: CSSProperties = { ...sectionBase, background: "rgba(250,250,252,0.95)" };
  
    const secTitle: CSSProperties = {
      fontWeight: 950,
      fontSize: 13,
      letterSpacing: 0.2,
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    };
  
    const tinyToggle: CSSProperties = {
      border: "1px solid rgba(0,0,0,0.10)",
      background: "rgba(255,255,255,0.80)",
      borderRadius: 999,
      padding: "6px 10px",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 12,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    };
  
    const inputLabel: CSSProperties = {
      fontSize: 12,
      fontWeight: 900,
      marginBottom: 6,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    };
  
    const tip: CSSProperties = {
      marginTop: 6,
      fontSize: 12,
      opacity: 0.75,
      lineHeight: 1.35,
    };
  
    const input: CSSProperties = {
      width: "100%",
      border: "1px solid rgba(0,0,0,0.10)",
      background: "rgba(255,255,255,0.92)",
      borderRadius: 12,
      padding: "12px 12px",
      outline: "none",
      color: "rgba(20,20,28,0.92)",
      fontWeight: 800,
    };
  
    const selectStyle: CSSProperties = {
      ...input,
      cursor: "pointer",
    };
  
    const grid2: CSSProperties = {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    };
  
    // condensed duration row (no wasted space)
    const gridDuration: CSSProperties = {
      display: "grid",
      gridTemplateColumns: "0.85fr 1.15fr",
      gap: 10,
      alignItems: "start",
    };
  
    const pill: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      padding: "6px 10px",
      border: "1px solid rgba(0,0,0,0.10)",
      background: "rgba(255,255,255,0.78)",
      fontSize: 12,
      fontWeight: 900,
      whiteSpace: "nowrap",
    };
  
    const pillGood: CSSProperties = {
      ...pill,
      border: "1px solid rgba(20,140,80,0.25)",
      background: "rgba(210,255,230,0.65)",
    };
  
    const pillWarn: CSSProperties = {
      ...pill,
      border: "1px solid rgba(180,40,40,0.22)",
      background: "rgba(255,220,220,0.70)",
    };
  
    const btnRow: CSSProperties = { display: "grid", gap: 10, marginTop: 12 };
  
    const btnBase: CSSProperties = {
      width: "100%",
      borderRadius: 14,
      padding: "12px 14px",
      fontWeight: 950,
      cursor: "pointer",
      border: "1px solid rgba(0,0,0,0.10)",
    };
  
    const btnPrimary: CSSProperties = {
      ...btnBase,
      background: "rgba(25,25,35,0.92)",
      color: "white",
      border: "1px solid rgba(0,0,0,0.10)",
    };
  
    const btnSecondary: CSSProperties = {
      ...btnBase,
      background: "rgba(255,255,255,0.90)",
      color: "rgba(20,20,28,0.92)",
    };
  
    const btnDisabled: CSSProperties = {
      ...btnBase,
      background: "rgba(240,240,242,1)",
      color: "rgba(20,20,28,0.45)",
      cursor: "not-allowed",
    };
  
    const linkBtn: CSSProperties = {
      ...btnSecondary,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    };
  
    const centeredNote: CSSProperties = {
      marginTop: 10,
      fontSize: 12,
      opacity: 0.78,
      textAlign: "center",
      lineHeight: 1.35,
    };
  
    const redCentered: CSSProperties = {
      marginTop: 10,
      fontSize: 13,
      textAlign: "center",
      fontWeight: 900,
      color: "rgba(180,40,40,0.95)",
    };
  
    const addrLink: CSSProperties = {
      fontWeight: 900,
      color: "rgba(20,20,28,0.92)",
      textDecoration: "none",
      borderBottom: "1px dotted rgba(20,20,28,0.35)",
    };

  return {
    overlay, modal, header, title, subtitle, closeBtn, body, sectionBase, secA, secB, secC, secD, secTitle, tinyToggle, inputLabel, tip, input, selectStyle, grid2, gridDuration, pill, pillGood, pillWarn, btnRow, btnBase, btnPrimary, btnSecondary, btnDisabled, linkBtn, centeredNote, redCentered, addrLink,
  };
}
