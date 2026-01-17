// src/features/raffles/RaffleCard.tsx
import type { CSSProperties } from "react";
import type { RaffleLite } from "./useRafflesHome";
import { Shield, BadgeCheck, AlertTriangle } from "lucide-react";
import { ADDR } from "../../lib/contracts";
import { formatToken } from "../../lib/formatMoney";

// ✅ NEW helper (pure formatter)
import { endsInText } from "../../lib/endsInText";

export function RaffleCard({
  raffle,
  nowMs,
  onOpen,
  onOpenSafety,
}: {
  raffle: RaffleLite;
  nowMs: number; // ✅ passed from Home/Explore (one shared ticking clock)
  onOpen: (id: string) => void;
  onOpenSafety?: (raffleId: string) => void;
}) {
  const soldNum = safeNum(raffle.sold);
  const maxNum = raffle.maxTickets ? safeNum(raffle.maxTickets) : null;

  const hasHardCap = !!maxNum && maxNum > 0;
  const percent = hasHardCap ? Math.min((soldNum / maxNum) * 100, 100) : 0;

  // ✅ Live countdown (text only)
  const endsRaw = endsInText(Number(raffle.deadline), nowMs); // "5m" | "12s" | "0s" | "—"
  const endsLabel =
    endsRaw === "—" ? "—" : endsRaw === "0s" ? "Ended" : `Ends in ${endsRaw}`;

  // ✅ Status pill (subgraph-based)
  const status = friendlyStatus(raffle.status, raffle.paused);

  // ✅ Right-side label: better UX while subgraph catches up
  const rightLabel = (() => {
    const s = (raffle.status || "").toLowerCase();
    if (raffle.paused) return "Paused";
    if (s.includes("drawing")) return "Drawing…";
    if (s.includes("completed")) return "Completed";
    if (s.includes("canceled") || s.includes("cancelled")) return "Canceled";

    // If still OPEN but timer hit 0, show “Awaiting draw…”
    if (s.includes("open") && endsRaw === "0s") return "Awaiting draw…";

    return endsLabel;
  })();

  // --- verification (subgraph) ---
  const dep = (raffle.deployer ?? "").toLowerCase();
  const isRegistered = raffle.isRegistered === true;
  const matchesDeployer = dep && dep === ADDR.deployer.toLowerCase();

  // "Official" requires BOTH: registered + matches known deployer
  const isOfficial = isRegistered && matchesDeployer;

  // If we don't have deployer info, we treat as unverified (don't silently hide)
  const hasVerificationData = !!dep || raffle.isRegistered !== undefined;

  return (
    <button
      type="button"
      onClick={() => onOpen(raffle.id)}
      style={cardWrap()}
      aria-label={`Open raffle ${raffle.name}`}
    >
      <div style={cardInner()}>
        {/* Top row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Status */}
            <div style={badge(status.kind)}>{status.label}</div>

            {/* Verification */}
            {hasVerificationData ? (
              isOfficial ? (
                <div
                  style={verifyPill("ok")}
                  title="Registered + created from the official Ppopgi deployer"
                >
                  <BadgeCheck size={14} /> Official
                </div>
              ) : (
                <div
                  style={verifyPill("warn")}
                  title="Unverified: not registered and/or not created from the official Ppopgi deployer"
                >
                  <AlertTriangle size={14} /> Unverified
                </div>
              )
            ) : (
              <div style={verifyPill("warn")} title="Verification data unavailable">
                <AlertTriangle size={14} /> Unverified
              </div>
            )}

            {/* Safety shield */}
            {onOpenSafety && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenSafety(raffle.id);
                }}
                style={shieldBtn()}
                aria-label="Safety & Proof"
                title="Safety & Proof"
              >
                <Shield size={16} />
              </button>
            )}
          </div>

          {/* ✅ Live right label */}
          <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
            {rightLabel}
          </div>
        </div>

        {/* Main */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 18, lineHeight: 1.1 }}>{raffle.name}</div>

          <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={pill()}>
              <span style={{ opacity: 0.75 }}>Win</span>{" "}
              <span style={{ fontWeight: 1000 }}>{formatToken(raffle.winningPot, 6)} USDC</span>
            </div>
            <div style={pill()}>
              <span style={{ opacity: 0.75 }}>Ticket</span>{" "}
              <span style={{ fontWeight: 1000 }}>{formatToken(raffle.ticketPrice, 6)} USDC</span>
            </div>
          </div>
        </div>

        {/* Progress / joined */}
        <div style={{ marginTop: 12 }}>
          {hasHardCap ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  opacity: 0.8,
                }}
              >
                <span style={{ fontWeight: 900 }}>Sold</span>
                <span style={{ fontWeight: 900 }}>
                  {soldNum}/{maxNum}
                </span>
              </div>
              <div style={progressTrack()}>
                <div style={progressFill(percent)} />
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                opacity: 0.8,
              }}
            >
              <span style={{ fontWeight: 900 }}>Joined</span>
              <span style={{ fontWeight: 900 }}>{soldNum}</span>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8 }}>Tap to view details</div>
          <div style={ctaPill()}>Open</div>
        </div>
      </div>
    </button>
  );
}

function safeNum(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function friendlyStatus(status: string, paused: boolean) {
  if (paused) return { label: "Paused", kind: "warn" as const };

  const s = (status || "").toLowerCase();
  if (s.includes("open")) return { label: "Open", kind: "ok" as const };
  if (s.includes("drawing")) return { label: "Drawing", kind: "info" as const };
  if (s.includes("completed")) return { label: "Completed", kind: "muted" as const };
  if (s.includes("canceled") || s.includes("cancelled")) return { label: "Canceled", kind: "muted" as const };

  return { label: status || "Unknown", kind: "muted" as const };
}

function cardWrap(): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    border: "none",
    padding: 0,
    background: "transparent",
    cursor: "pointer",
  };
}

function cardInner(): CSSProperties {
  return {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(14px)",
    boxShadow: "0 10px 34px rgba(0,0,0,0.08)",
    padding: 14,
    transition: "transform 160ms ease, box-shadow 160ms ease",
  };
}

function badge(kind: "ok" | "warn" | "info" | "muted"): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 1000,
    fontSize: 12,
    border: "1px dashed rgba(255,255,255,0.55)",
  };

  if (kind === "ok") return { ...base, background: "rgba(140, 255, 200, 0.18)" };
  if (kind === "warn") return { ...base, background: "rgba(255, 210, 120, 0.20)" };
  if (kind === "info") return { ...base, background: "rgba(169, 212, 255, 0.18)" };
  return { ...base, background: "rgba(255,255,255,0.14)" };
}

function verifyPill(tone: "ok" | "warn"): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 1000,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.18)",
  };

  if (tone === "ok") return { ...base, background: "rgba(120, 255, 190, 0.16)" };
  return { ...base, background: "rgba(255, 210, 120, 0.18)" };
}

function shieldBtn(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 30,
    width: 30,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.22)",
    cursor: "pointer",
  };
}

function pill(): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.40)",
    background: "rgba(255,255,255,0.20)",
    fontSize: 12,
  };
}

function progressTrack(): CSSProperties {
  return {
    marginTop: 8,
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.35)",
    overflow: "hidden",
  };
}

function progressFill(percent: number): CSSProperties {
  return {
    height: "100%",
    width: `${Math.max(0, Math.min(100, percent))}%`,
    background: "rgba(255, 216, 154, 0.85)",
    borderRadius: 999,
    transition: "width 350ms ease",
  };
}

function ctaPill(): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.50)",
    background: "rgba(255,255,255,0.22)",
    fontWeight: 1000,
    fontSize: 12,
  };
}