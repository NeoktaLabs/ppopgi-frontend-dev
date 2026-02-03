// src/components/RaffleCard.tsx
import React, { useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { formatUnits } from "ethers";
import "./raffleCard.css";

type HatchUI = {
  // Whether to show the hatch section at all
  show: boolean;

  // Button label + state
  ready: boolean;
  label: string; // e.g. "Hatch ready" or "Hatch in 03:12:10"

  // button behavior
  disabled?: boolean;
  busy?: boolean;
  onClick?: (e: React.MouseEvent) => void;

  // optional small note line
  note?: string | null;
};

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;

  // ✅ NEW (optional): open SafetyProofModal for this raffle
  onOpenSafety?: (id: string) => void;

  // Podium styling (top 3 only)
  ribbon?: "gold" | "silver" | "bronze";

  // ✅ NEW: caller can pass a shared clock to avoid per-card intervals
  nowMs?: number;

  // ✅ NEW: Optional hatch UI (provided by Dashboard, using on-chain reads)
  // IMPORTANT: allow null so Dashboard can return null when hatch should not show.
  hatch?: HatchUI | null;
};

function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

function formatEndsIn(deadlineSeconds: string, nowMs: number) {
  const n = Number(deadlineSeconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown";

  const deadlineMs = n * 1000;
  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) return "Ended";

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad2 = (x: number) => String(x).padStart(2, "0");
  const d = days > 0 ? `${days}d ` : "";
  return `${d}${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}

function baseStatusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

type DisplayStatus =
  | "Open"
  | "Finalizing"
  | "Drawing"
  | "Settled"
  | "Canceled"
  | "Getting ready"
  | "Unknown";

function statusTheme(s: DisplayStatus) {
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

// Shiny podium “foil” backgrounds (only for top 3 cards)
function podiumFoil(kind: "gold" | "silver" | "bronze") {
  if (kind === "gold") {
    return {
      bg:
        "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)," +
        "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)," +
        "linear-gradient(135deg, rgba(255,216,154,0.98), rgba(255,190,120,0.90) 40%, rgba(255,232,190,0.92))",
      ink: "#4A2A00",
      inkStrong: "#3A1F00",
      tear: "rgba(150,88,0,0.55)",
    };
  }
  if (kind === "silver") {
    return {
      bg:
        "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)," +
        "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)," +
        "linear-gradient(135deg, rgba(236,241,250,0.98), rgba(218,226,238,0.92) 45%, rgba(245,248,255,0.92))",
      ink: "#1F2A3A",
      inkStrong: "#121B29",
      tear: "rgba(40,60,90,0.40)",
    };
  }
  // bronze
  return {
    bg:
      "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.82), rgba(255,255,255,0) 55%)," +
      "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.52), rgba(255,255,255,0) 60%)," +
      "linear-gradient(135deg, rgba(246,182,200,0.98), rgba(206,130,105,0.92) 45%, rgba(255,220,205,0.92))",
    ink: "#4A1A12",
    inkStrong: "#35110B",
    tear: "rgba(120,55,40,0.45)",
  };
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatWhen(tsSeconds: string | null | undefined) {
  const n = Number(tsSeconds || "0");
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  try {
    return new Date(n * 1000).toLocaleString();
  } catch {
    return "Unknown time";
  }
}

function normalizeCancelReason(reason?: string | null) {
  const r = (reason || "").trim().toLowerCase();
  if (r.includes("min") && r.includes("ticket")) return "Min tickets sold not reached";
  if (r.includes("minimum") && r.includes("ticket")) return "Min tickets sold not reached";
  if (r.includes("not enough") && r.includes("ticket")) return "Min tickets sold not reached";
  return reason?.trim() ? reason.trim() : "Canceled";
}

export function RaffleCard({ raffle, onOpen, onOpenSafety, ribbon, nowMs, hatch }: Props) {
  // 🔧 Proportional scale for the whole card
  const SCALE = 0.88;
  const s = (n: number) => Math.round(n * SCALE);

  // ✅ No interval here anymore — App passes nowMs (or fallback to a static snapshot)
  const clockMs = nowMs ?? Date.now();

  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [isHover, setIsHover] = useState(false);

  const shareUrl = useMemo(() => {
    const u = new URL(window.location.href);
    u.search = "";
    u.searchParams.set("raffle", raffle.id);
    u.hash = "";
    return u.toString();
  }, [raffle.id]);

  async function onShareCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const msg = "Link copied — share it with your friends!";
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl, title: raffle.name, text: "Join this raffle" });
        setCopyMsg("Shared!");
        window.setTimeout(() => setCopyMsg(null), 1200);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setCopyMsg(msg);
    } catch {
      window.prompt("Copy this link:", shareUrl);
      setCopyMsg("Copy the link");
    }

    window.setTimeout(() => setCopyMsg(null), 1400);
  }

  function onSafetyClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (onOpenSafety) onOpenSafety(raffle.id);
  }

  const deadlineMs = useMemo(() => {
    const n = Number(raffle.deadline);
    return Number.isFinite(n) ? n * 1000 : 0;
  }, [raffle.deadline]);

  const deadlinePassed = deadlineMs > 0 ? clockMs >= deadlineMs : false;

  const displayStatus: DisplayStatus = useMemo(() => {
    if (raffle.status === "OPEN" && deadlinePassed) return "Finalizing";
    return baseStatusLabel(raffle.status) as DisplayStatus;
  }, [raffle.status, deadlinePassed]);

  const showProgress = displayStatus === "Open" || displayStatus === "Getting ready";

  const bottomLine = useMemo(() => {
    if (displayStatus === "Open" || displayStatus === "Getting ready") return formatEndsIn(raffle.deadline, clockMs);
    if (displayStatus === "Finalizing") return "Draw in progress";
    if (displayStatus === "Drawing") return "Draw in progress";
    if (displayStatus === "Settled") return "Settled";
    if (displayStatus === "Canceled") return "Canceled";
    return "Unknown";
  }, [displayStatus, raffle.deadline, clockMs]);

  const anyRaffle = raffle as any;
  const soldN = useMemo(() => toNum(raffle.sold ?? "0"), [raffle.sold]);
  const minN = useMemo(() => toNum(anyRaffle?.minTickets ?? 0), [anyRaffle?.minTickets]);
  const maxN = useMemo(
    () => toNum(raffle.maxTickets ?? anyRaffle?.maxTickets ?? "0"),
    [raffle.maxTickets, anyRaffle?.maxTickets]
  );

  const hasMin = minN > 0;
  const hasMax = maxN > 0;

  const minReached = hasMin ? soldN >= minN : false;

  const minProgress = hasMin ? clamp01(soldN / minN) : 0;
  const maxProgress = hasMax ? clamp01(soldN / maxN) : 0;

  const soldLine = useMemo(() => {
    if (hasMax) return `${soldN} / ${maxN}`;
    return `${soldN}`;
  }, [soldN, hasMax, maxN]);

  const maxTicketsText = useMemo(() => {
    if (!hasMax) return "∞";
    return String(maxN);
  }, [hasMax, maxN]);

  const pastHeadline = useMemo(() => {
    if (displayStatus === "Settled") return `Settled at ${formatWhen(raffle.completedAt)}`;
    if (displayStatus === "Canceled") return `Canceled at ${formatWhen(raffle.canceledAt)}`;
    if (displayStatus === "Drawing") return "Draw in progress";
    if (displayStatus === "Finalizing") return "Draw in progress";
    return null;
  }, [displayStatus, raffle.completedAt, raffle.canceledAt]);

  const pastSubline = useMemo(() => {
    if (displayStatus === "Settled") return raffle.winner ? "Someone won!" : "Settled";
    if (displayStatus === "Canceled") return normalizeCancelReason(raffle.canceledReason);
    if (displayStatus === "Drawing" || displayStatus === "Finalizing") return "Waiting for the result";
    return null;
  }, [displayStatus, raffle.winner, raffle.canceledReason]);

  const baseInk = "#5C1F3B";
  const baseInkStrong = "#4A0F2B";
  const foil = ribbon ? podiumFoil(ribbon) : null;

  const ink = foil?.ink ?? baseInk;
  const inkStrong = foil?.inkStrong ?? baseInkStrong;

  const status = statusTheme(displayStatus);

  const card: React.CSSProperties = {
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

  const notch: React.CSSProperties = {
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

  const tearLine: React.CSSProperties = {
    marginTop: s(14),
    height: 1,
    background:
      "repeating-linear-gradient(90deg, " +
      `${foil?.tear ?? "rgba(180,70,120,0.62)"} , ${foil?.tear ?? "rgba(180,70,120,0.62)"} 7px,` +
      " rgba(0,0,0,0) 7px, rgba(0,0,0,0) 14px)",
    opacity: 0.8,
    pointerEvents: "none",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: s(10),
  };

  const statusChip: React.CSSProperties = {
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

  const shareBtn: React.CSSProperties = {
    width: s(34),
    height: s(34),
    borderRadius: s(12),
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(0,0,0,0.08)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  };

  const safetyBtn: React.CSSProperties = {
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

  const copyToast: React.CSSProperties = {
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

  const titleWrap: React.CSSProperties = { marginTop: s(10), textAlign: "center" };

  const smallKicker: React.CSSProperties = {
    fontSize: s(12),
    fontWeight: 800,
    opacity: 0.9,
    color: ink,
  };

  const titleText: React.CSSProperties = {
    marginTop: s(4),
    fontSize: s(18),
    fontWeight: 950,
    letterSpacing: 0.1,
    lineHeight: 1.15,
    color: inkStrong,
  };

  const prizeKicker: React.CSSProperties = {
    marginTop: s(14),
    fontSize: s(12),
    fontWeight: 950,
    letterSpacing: 0.45,
    textTransform: "uppercase",
    opacity: 0.92,
    color: ink,
    textAlign: "center",
  };

  const prizeValue: React.CSSProperties = {
    marginTop: s(8),
    fontSize: s(34),
    fontWeight: 1000 as any,
    lineHeight: 1.0,
    letterSpacing: 0.2,
    textAlign: "center",
    color: inkStrong,
    textShadow: "0 1px 0 rgba(255,255,255,0.35)",
  };

  const midGrid: React.CSSProperties = {
    marginTop: s(16),
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: s(12),
  };

  const mini: React.CSSProperties = {
    borderRadius: s(14),
    padding: s(12),
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
  };

  const miniLabel: React.CSSProperties = {
    fontSize: s(12),
    fontWeight: 950,
    letterSpacing: 0.25,
    opacity: 0.9,
    color: ink,
  };

  const miniValue: React.CSSProperties = {
    marginTop: s(6),
    fontSize: s(14),
    fontWeight: 950,
    color: inkStrong,
  };

  const hint: React.CSSProperties = {
    marginTop: s(4),
    fontSize: s(11),
    fontWeight: 800,
    opacity: 0.88,
    color: ink,
  };

  const blockSlot: React.CSSProperties = { marginTop: s(12), minHeight: s(86) };

  const barWrap: React.CSSProperties = { display: "grid", gap: s(8) };

  const barLabelRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: s(10),
  };

  const barTrack: React.CSSProperties = {
    height: s(10),
    borderRadius: 999,
    background: "rgba(0,0,0,0.10)",
    overflow: "hidden",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.10)",
  };

  const barFillBase: React.CSSProperties = { height: "100%", borderRadius: 999, transition: "width 220ms ease" };

  const barFillPending: React.CSSProperties = {
    ...barFillBase,
    background: "linear-gradient(90deg, rgba(59,130,246,0.95), rgba(169,212,255,0.95))",
  };

  const barFillMin: React.CSSProperties = {
    ...barFillBase,
    background: "linear-gradient(90deg, rgba(34,197,94,0.95), rgba(145,247,184,0.95))",
  };

  const barFillMax: React.CSSProperties = {
    ...barFillBase,
    background: "linear-gradient(90deg, rgba(168,85,247,0.95), rgba(203,183,246,0.95))",
  };

  const barFillInfinite: React.CSSProperties = {
    ...barFillBase,
    width: "100%",
    background:
      "repeating-linear-gradient(45deg, rgba(168,85,247,0.95), rgba(168,85,247,0.95) 10px, rgba(168,85,247,0.55) 10px, rgba(168,85,247,0.55) 20px)",
    opacity: 0.85,
  };

  const smallHint: React.CSSProperties = {
    fontSize: s(11),
    fontWeight: 900,
    color: ink,
    opacity: 0.92,
  };

  const pastBlock: React.CSSProperties = {
    borderRadius: s(14),
    padding: s(12),
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
    display: "grid",
    gap: s(6),
  };

  const pastLine1: React.CSSProperties = { fontSize: s(12), fontWeight: 950, color: inkStrong, lineHeight: 1.25 };
  const pastLine2: React.CSSProperties = {
    fontSize: s(12),
    fontWeight: 900,
    color: ink,
    opacity: 0.92,
    lineHeight: 1.25,
  };

  const bottomRow: React.CSSProperties = {
    marginTop: s(14),
    paddingTop: s(12),
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: s(10),
  };

  const bottomText: React.CSSProperties = { fontSize: s(14), fontWeight: 950, color: inkStrong, letterSpacing: 0.2 };

  const pulseBottom = displayStatus === "Finalizing" || displayStatus === "Drawing";

  // ✅ integrated hatch UI (inside card)
  // IMPORTANT: if Dashboard passes null, hatch is hidden and we avoid TS union issues.
  const showHatch = !!hatch;

  const hatchWrap: React.CSSProperties = {
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

  const hatchTop: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: s(10),
  };

  const hatchTitle: React.CSSProperties = {
    fontSize: s(12),
    fontWeight: 1000,
    color: inkStrong,
    letterSpacing: 0.2,
  };

  const hatchLabel: React.CSSProperties = {
    fontSize: s(11),
    fontWeight: 900,
    color: ink,
    opacity: 0.95,
    textAlign: "right",
  };

  const hatchBtn: React.CSSProperties = {
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

  const hatchNote: React.CSSProperties = {
    fontSize: s(11),
    fontWeight: 900,
    color: inkStrong,
    opacity: 0.92,
    lineHeight: 1.25,
  };

  return (
    <div
      style={card}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(raffle.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(raffle.id);
      }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      title="Open raffle"
    >
      <div style={{ ...notch, left: -Math.max(6, Math.floor(s(18) / 2)) }} />
      <div style={{ ...notch, right: -Math.max(6, Math.floor(s(18) / 2)) }} />

      <div style={topRow}>
        <div style={statusChip} className={status.pulse ? "pp-rc-pulse" : undefined}>
          {displayStatus.toUpperCase()}
        </div>

        <div style={{ display: "flex", gap: s(8) }}>
          <button
            style={safetyBtn}
            onClick={onSafetyClick}
            title={onOpenSafety ? "Safety info" : "Safety info (not available)"}
            aria-label="Safety info"
            disabled={!onOpenSafety}
          >
            <svg width={s(18)} height={s(18)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2l8 4v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4Z"
                stroke="#0B2E5C"
                strokeWidth="2"
                strokeLinejoin="round"
                opacity="0.95"
              />
              <path
                d="M9.2 12.2l1.9 1.9 3.9-3.9"
                stroke="#0B2E5C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
              />
            </svg>
          </button>

          <button style={shareBtn} onClick={onShareCopy} title="Share" aria-label="Share">
            <svg width={s(18)} height={s(18)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M14 3h7v7" stroke={inkStrong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 3l-9 9" stroke={inkStrong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M10 7H7a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3"
                stroke={inkStrong}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            </svg>
          </button>
        </div>
      </div>

      {copyMsg && <div style={copyToast}>{copyMsg}</div>}

      <div style={titleWrap}>
        <div style={smallKicker}>Ppopgi</div>
        <div style={titleText} className="pp-rc-titleClamp" title={raffle.name}>
          {raffle.name}
        </div>
      </div>

      <div style={prizeKicker}>Winner gets</div>
      <div style={prizeValue}>{fmtUsdc(raffle.winningPot)} USDC</div>

      <div style={tearLine} />

      <div style={midGrid}>
        <div style={mini}>
          <div style={miniLabel}>Ticket price</div>
          <div style={miniValue}>{fmtUsdc(raffle.ticketPrice)} USDC</div>
        </div>

        <div style={mini}>
          <div style={miniLabel}>Tickets sold</div>
          <div style={miniValue}>{soldLine}</div>
          <div style={hint}>{hasMax ? `Max: ${maxTicketsText}` : "No max limit"}</div>
        </div>
      </div>

      <div style={blockSlot}>
        {showProgress && hasMin ? (
          <div style={barWrap}>
            {!minReached ? (
              <>
                <div style={barLabelRow}>
                  <span style={miniLabel}>Minimum needed</span>
                  <span style={smallHint}>
                    {soldN} / {minN}
                  </span>
                </div>
                <div style={barTrack}>
                  <div style={{ ...barFillPending, width: `${Math.round(minProgress * 100)}%` }} />
                </div>
                <div style={{ fontSize: s(11), opacity: 0.88, color: ink }}>
                  This minimum must be reached before the draw step can happen.
                </div>
              </>
            ) : (
              <>
                <div style={barLabelRow}>
                  <span style={miniLabel}>Minimum reached</span>
                  <span style={smallHint}>{soldN} sold</span>
                </div>
                <div style={barTrack}>
                  <div style={{ ...barFillMin, width: "100%" }} />
                </div>

                <div style={barLabelRow}>
                  <span style={miniLabel}>Tickets</span>
                  <span style={smallHint}>{hasMax ? `${soldN} / ${maxN}` : `${soldN} / ∞`}</span>
                </div>
                <div style={barTrack}>
                  {hasMax ? (
                    <div style={{ ...barFillMax, width: `${Math.round(maxProgress * 100)}%` }} />
                  ) : (
                    <div style={barFillInfinite} />
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={pastBlock}>
            <div style={pastLine1} className={pulseBottom ? "pp-rc-pulse" : undefined}>
              {pastHeadline ?? bottomLine}
            </div>
            <div style={pastLine2}>{pastSubline ?? ""}</div>
          </div>
        )}
      </div>

      {/* ✅ Hatch section lives INSIDE the card now */}
      {showHatch && (
        <div style={hatchWrap} onClick={(e) => e.stopPropagation()} role="region" aria-label="Emergency hatch">
          <div style={hatchTop}>
            <div style={hatchTitle}>⚠️ Emergency hatch</div>
            <div style={hatchLabel}>{hatch?.label}</div>
          </div>

          <button
            style={hatchBtn}
            disabled={!!hatch?.disabled || !!hatch?.busy || !hatch?.ready}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              hatch?.onClick?.(e);
            }}
            title="Calls forceCancelStuck() on the raffle contract"
          >
            {hatch?.busy ? "Confirming…" : hatch?.ready ? "Hatch (cancel stuck draw)" : "Hatch locked"}
          </button>

          {!!hatch?.note && <div style={hatchNote}>{hatch.note}</div>}
        </div>
      )}

      <div style={bottomRow}>
        <div style={bottomText}>
          {displayStatus === "Open" || displayStatus === "Getting ready" ? (
            `Ends in ${bottomLine}`
          ) : (
            <span
              className={pulseBottom ? "pp-rc-pulse" : undefined}
              style={pulseBottom ? { color: "#0B2E5C" } : undefined}
            >
              {bottomLine}
            </span>
          )}
        </div>

        <svg width={s(18)} height={s(18)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2l1.2 4.5L18 8l-4.8 1.5L12 14l-1.2-4.5L6 8l4.8-1.5L12 2Z"
            stroke={inkStrong}
            strokeWidth="2"
            strokeLinejoin="round"
            opacity="0.85"
          />
          <path
            d="M19 13l.7 2.5L22 16l-2.3.5L19 19l-.7-2.5L16 16l2.3-.5L19 13Z"
            stroke={inkStrong}
            strokeWidth="2"
            strokeLinejoin="round"
            opacity="0.75"
          />
        </svg>
      </div>
    </div>
  );
}