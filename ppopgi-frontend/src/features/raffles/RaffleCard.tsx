// src/features/raffles/RaffleCard.tsx
import type { CSSProperties } from "react";
import type { RaffleLite } from "./useRafflesHome";
import { Shield } from "lucide-react";

export function RaffleCard({
  raffle,
  onOpen,
  onOpenSafety,
}: {
  raffle: RaffleLite;
  onOpen: (id: string) => void;
  onOpenSafety?: (raffleId: string) => void;
}) {
  const soldNum = safeNum(raffle.sold);
  const maxNum = raffle.maxTickets ? safeNum(raffle.maxTickets) : null;

  const hasHardCap = !!maxNum && maxNum > 0;
  const percent = hasHardCap ? Math.min((soldNum / maxNum) * 100, 100) : 0;

  const endsIn = formatEndsIn(raffle.deadline);
  const status = friendlyStatus(raffle.status, raffle.paused);

  return (
    <button
      type="button"
      onClick={() => onOpen(raffle.id)}
      style={cardWrap()}
      aria-label={`Open raffle ${raffle.name}`}
    >
      <div style={cardInner()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={badge(status.kind)}>{status.label}</div>

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

          <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.75 }}>{endsIn}</div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 18, lineHeight: 1.1 }}>{raffle.name}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={pill()}>
              <span style={{ opacity: 0.75 }}>Win</span>{" "}
              <span style={{ fontWeight: 1000 }}>{raffle.winningPot} USDC</span>
            </div>
            <div style={pill()}>
              <span style={{ opacity: 0.75 }}>Ticket</span>{" "}
              <span style={{ fontWeight: 1000 }}>{raffle.ticketPrice} USDC</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {hasHardCap ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.8 }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.8 }}>
              <span style={{ fontWeight: 900 }}>Joined</span>
              <span style={{ fontWeight: 900 }}>{soldNum}</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

function formatEndsIn(deadline: string): string {
  const dl = Number(deadline);
  if (!Number.isFinite(dl) || dl <= 0) return "—";

  const diffMs = dl * 1000 - Date.now();
  if (diffMs <= 0) return "Ended";

  const mins = Math.floor(diffMs / 60000);
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;

  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${m}m`;
  return `Ends in ${m}m`;
}

function friendlyStatus(status: string, paused: boolean) {
  if (paused) return { label: "Paused", kind: "warn" as const };

  const s = (status || "").toLowerCase();
  if (s.includes("open")) return { label: "Open", kind: "ok" as const };
  if (s.includes("drawing")) return { label: "Drawing", kind: "info" as const };
  if (s.includes("ended") || s.includes("closed") || s.includes("finished")) return { label: "Ended", kind: "muted" as const };
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