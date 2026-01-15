import type { RaffleLite } from "./useRafflesHome";
import { friendlyStatus } from "../../lib/format";

function shorten(s: string, start = 6, end = 4) {
  if (!s) return "";
  if (s.length <= start + end + 3) return s;
  return `${s.slice(0, start)}…${s.slice(-end)}`;
}

function secondsLeft(deadline: string) {
  const dl = Number(deadline);
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, dl - now);
}

function formatTimeLeft(sec: number) {
  if (sec <= 0) return "Ended";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function RaffleCard({
  raffle,
  onOpen,
}: {
  raffle: RaffleLite;
  onOpen: (id: string) => void;
}) {
  const left = formatTimeLeft(secondsLeft(raffle.deadline));

  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.40)",
        background:
          "linear-gradient(135deg, rgba(246,182,200,0.22), rgba(255,255,255,0.14))",
        backdropFilter: "blur(14px)",
        boxShadow: "0 10px 34px rgba(0,0,0,0.10)",
        padding: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ticket notches */}
      <div
        style={{
          position: "absolute",
          left: -10,
          top: "50%",
          width: 20,
          height: 20,
          borderRadius: 999,
          background: "rgba(255,246,239,0.90)",
          transform: "translateY(-50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -10,
          top: "50%",
          width: 20,
          height: 20,
          borderRadius: 999,
          background: "rgba(255,246,239,0.90)",
          transform: "translateY(-50%)",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>{raffle.name || "Raffle"}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Proof: {shorten(raffle.id)}</div>
        </div>

        <div
          style={{
            alignSelf: "start",
            padding: "5px 10px",
            borderRadius: 999,
            border: "1px dashed rgba(255,255,255,0.55)",
            background: "rgba(203,183,246,0.18)",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          {friendlyStatus(raffle.status)}
          {raffle.paused ? " (paused)" : ""}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          borderTop: "1px dashed rgba(255,255,255,0.55)",
          paddingTop: 10,
          display: "grid",
          gap: 6,
          fontSize: 14,
        }}
      >
        <div>
          <span style={{ fontWeight: 900 }}>Win:</span> {raffle.winningPot} USDC
        </div>
        <div>
          <span style={{ fontWeight: 900 }}>Ticket:</span> {raffle.ticketPrice} USDC
        </div>
        <div>
          <span style={{ fontWeight: 900 }}>Ends in:</span> {left}
        </div>
        <div>
          <span style={{ fontWeight: 900 }}>Joined:</span> {raffle.sold}
          {raffle.maxTickets ? ` (Max: ${raffle.maxTickets})` : ""}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button
          onClick={() => onOpen(raffle.id)}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.50)",
            background: "rgba(255,255,255,0.28)",
            cursor: "pointer",
            fontWeight: 1000,
          }}
        >
          Open
        </button>

        <button
          onClick={() => {
            const url = `${window.location.origin}/#raffle=${encodeURIComponent(
              raffle.id.toLowerCase()
            )}`;
            navigator.clipboard?.writeText(url);
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.50)",
            background: "rgba(255,255,255,0.20)",
            cursor: "pointer",
            fontWeight: 1000,
          }}
        >
          Share
        </button>
      </div>
    </div>
  );
}