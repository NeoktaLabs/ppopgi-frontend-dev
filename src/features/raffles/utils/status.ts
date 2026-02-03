export type DisplayStatus =
  | "Open"
  | "Finalizing"
  | "Drawing"
  | "Settled"
  | "Canceled"
  | "Getting ready"
  | "Unknown";

export function baseStatusLabel(s: string): DisplayStatus {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

export function normalizeCancelReason(reason?: string | null) {
  const r = (reason || "").trim().toLowerCase();
  if (r.includes("min") && r.includes("ticket")) return "Min tickets sold not reached";
  if (r.includes("minimum") && r.includes("ticket")) return "Min tickets sold not reached";
  if (r.includes("not enough") && r.includes("ticket")) return "Min tickets sold not reached";
  return reason?.trim() ? reason.trim() : "Canceled";
}

export function statusTheme(s: DisplayStatus) {
  if (s === "Open")
    return { bg: "rgba(145, 247, 184, 0.92)", fg: "#0B4A24", border: "1px solid rgba(0,0,0,0.06)" };

  if (s === "Finalizing" || s === "Drawing")
    return {
      bg: "rgba(169, 212, 255, 0.95)",
      fg: "#0B2E5C",
      border: "1px solid rgba(0,0,0,0.10)",
      pulse: true,
    };

  if (s === "Settled")
    return { bg: "rgba(255, 216, 154, 0.92)", fg: "#4A2A00", border: "1px solid rgba(0,0,0,0.08)" };

  if (s === "Canceled")
    return { bg: "rgba(255, 120, 140, 0.92)", fg: "#5A0012", border: "1px solid rgba(0,0,0,0.10)" };

  if (s === "Getting ready")
    return { bg: "rgba(203, 183, 246, 0.92)", fg: "#2E1C5C", border: "1px solid rgba(0,0,0,0.08)" };

  return { bg: "rgba(255,255,255,0.72)", fg: "#5C2A3E", border: "1px solid rgba(0,0,0,0.08)" };
}
