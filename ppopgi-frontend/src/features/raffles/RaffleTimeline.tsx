import { addrUrl, txUrl } from "../../lib/explorer";
import { timeAgoFromSeconds } from "../../lib/time";

type RaffleEvent = {
  type: string;
  blockTimestamp: string;
  actor?: string | null;
  target?: string | null;
  amount?: string | null;
  amount2?: string | null;
  text?: string | null;
  txHash?: string | null;
};

function labelForType(t: string) {
  // Keep it calm + simple
  switch ((t || "").toUpperCase()) {
    case "TICKETS_PURCHASED":
      return "Tickets bought";
    case "LOTTERY_FINALIZED":
      return "Draw requested";
    case "WINNER_PICKED":
      return "Winner selected";
    case "LOTTERY_CANCELED":
      return "Cancelled";
    case "FUNDS_CLAIMED":
      return "Funds claimed";
    case "NATIVE_CLAIMED":
      return "Energy coins claimed";
    case "PAUSED":
      return "Paused";
    case "UNPAUSED":
      return "Unpaused";
    default:
      return t;
  }
}

function shortAddr(a?: string | null) {
  if (!a) return "";
  const s = a.toString();
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function RaffleTimeline({ events }: { events: RaffleEvent[] }) {
  if (!events.length) {
    return <div style={{ opacity: 0.85 }}>No timeline yet.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {events.map((e, idx) => (
        <div
          key={idx}
          style={{
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 16,
            padding: 12,
            background: "rgba(255,255,255,0.16)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>{labelForType(e.type)}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {timeAgoFromSeconds(e.blockTimestamp)}
            </div>
          </div>

          {e.text && <div style={{ marginTop: 6 }}>{e.text}</div>}

          <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
            {e.actor && (
              <a href={addrUrl(e.actor)} target="_blank" rel="noreferrer">
                {shortAddr(e.actor)}
              </a>
            )}
            {e.target && (
              <a href={addrUrl(e.target)} target="_blank" rel="noreferrer">
                {shortAddr(e.target)}
              </a>
            )}
            {e.amount && <span style={{ opacity: 0.85 }}>{e.amount}</span>}
            {e.txHash && (
              <a href={txUrl(e.txHash)} target="_blank" rel="noreferrer" style={{ fontWeight: 900 }}>
                Proof
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}