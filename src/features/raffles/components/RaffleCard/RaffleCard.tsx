// src/components/RaffleCard.tsx
import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { RaffleListItem } from "../../../../shared/lib/indexer/subgraph";
import "./raffleCard.css";

import { fmtUsdc, formatEndsIn, formatWhen } from "../../utils/format";
import { baseStatusLabel, normalizeCancelReason, statusTheme, type DisplayStatus } from "../../utils/status";
import { clamp01, toNum } from "../../utils/numbers";
import { podiumFoil } from "./podiumFoil";
import { createRaffleCardStyles } from "./RaffleCard.styles";

type HatchUI = {
  // Whether to show the hatch section at all
  show: boolean;

  // Button label + state
  ready: boolean;
  label: string; // e.g. "Hatch ready" or "Hatch in 03:12:10"

  // button behavior
  disabled?: boolean;
  busy?: boolean;
  onClick?: (e: MouseEvent) => void;

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

  async function onShareCopy(e: MouseEvent) {
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

  function onSafetyClick(e: MouseEvent) {
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
  const pulseBottom = displayStatus === "Finalizing" || displayStatus === "Drawing";
  const showHatch = !!hatch;


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
  const { card, notch, tearLine, topRow, statusChip, shareBtn, safetyBtn, copyToast, titleWrap, smallKicker, titleText, prizeKicker, prizeValue, midGrid, mini, miniLabel, miniValue, hint, blockSlot, barWrap, barLabelRow, barTrack, barFillPending, barFillMin, barFillMax, barFillInfinite, smallHint, pastBlock, pastLine1, pastLine2, bottomRow, bottomText, hatchWrap, hatchTop, hatchTitle, hatchLabel, hatchBtn, hatchNote } = createRaffleCardStyles({ s, isHover, foil, status, ink, inkStrong, onOpenSafety, displayStatus, hatch });

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