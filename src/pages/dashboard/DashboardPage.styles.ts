import type { CSSProperties } from "react";

export function createDashboardStyles() {
  const section: CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.55)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.10))," +
      "radial-gradient(900px 220px at 15% 0%, rgba(255,141,187,0.10), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 220px at 85% 0%, rgba(203,183,246,0.10), rgba(203,183,246,0) 55%)",
    boxShadow: "0 16px 34px rgba(0,0,0,0.12)",
    backdropFilter: "blur(10px)",
  };

  const grid: CSSProperties = { marginTop: 12, display: "grid", gap: 12 };

  const pill: CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    color: "#4A0F2B",
    fontWeight: 950,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  const actionBtn: CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 14,
    padding: "12px 12px",
    cursor: "pointer",
    fontWeight: 1000,
    color: "#4A0F2B",
    width: "100%",
  };

  const actionBtnDisabled: CSSProperties = { ...actionBtn, opacity: 0.55, cursor: "not-allowed" };

  const subCard: CSSProperties = {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.20)",
    display: "grid",
    gap: 10,
  };
  return {
    section, grid, pill, actionBtn, actionBtnDisabled, subCard,
  };
}
