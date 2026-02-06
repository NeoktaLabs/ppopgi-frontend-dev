import { useState, useEffect, useMemo } from "react";
import { useRaffleInteraction } from "../hooks/useRaffleInteraction";
import { useRaffleParticipants } from "../hooks/useRaffleParticipants";
import { fetchRaffleMetadata, type RaffleListItem } from "../indexer/subgraph";
import "./RaffleDetailsModal.css";

/* ---------------------------------- Helpers ---------------------------------- */

const ExplorerLink = ({ addr, label }: { addr: string; label?: string }) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return <span>{label || "—"}</span>;
  const a = String(addr).toLowerCase();
  return (
    <a
      href={`https://explorer.etherlink.com/address/${a}`}
      target="_blank"
      rel="noreferrer"
      className="rdm-info-link"
    >
      {label || `${a.slice(0, 6)}...${a.slice(-4)}`}
    </a>
  );
};

const TxLink = ({ hash }: { hash?: string | null }) => {
  if (!hash) return null;
  const h = String(hash).toLowerCase();
  return (
    <a
      href={`https://explorer.etherlink.com/tx/${h}`}
      target="_blank"
      rel="noreferrer"
      className="rdm-tl-tx"
    >
      View Tx ↗
    </a>
  );
};

const formatDate = (ts: any) => {
  if (!ts || ts === "0") return "—";
  return new Date(Number(ts) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ---------------------------------- Types ---------------------------------- */

type RaffleEventRow = {
  type: string;
  blockTimestamp: string;
  txHash: string;
  actor?: string | null;
};

type Props = {
  open: boolean;
  raffleId: string | null;
  onClose: () => void;
  initialRaffle?: RaffleListItem | null;
};

/* ---------------------------------- Component ---------------------------------- */

export function RaffleDetailsModal({ open, raffleId, onClose, initialRaffle }: Props) {
  const { state, math, flags, actions } = useRaffleInteraction(raffleId, open);
  const [tab, setTab] = useState<"receipt" | "holders">("receipt");
  const [metadata, setMetadata] = useState<Partial<RaffleListItem> | null>(null);
  const [events, setEvents] = useState<RaffleEventRow[] | null>(null);

  /* ------------------------------ Metadata & Events ------------------------------ */

  useEffect(() => {
    if (!raffleId || !open) {
      setMetadata(null);
      setEvents(null);
      setTab("receipt");
      return;
    }

    if (initialRaffle?.createdAtTimestamp) setMetadata(initialRaffle);

    let active = true;

    if (!initialRaffle?.createdAtTimestamp) {
      fetchRaffleMetadata(raffleId).then((data) => {
        if (active && data) setMetadata(data);
      });
    }

    fetch(`${import.meta.env.VITE_SUBGRAPH_URL}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `
          query Events($id: Bytes!) {
            raffleEvents(where: { raffle: $id }, orderBy: blockTimestamp, orderDirection: asc) {
              type
              blockTimestamp
              txHash
              actor
            }
          }
        `,
        variables: { id: raffleId.toLowerCase() },
      }),
    })
      .then((r) => r.json())
      .then((j) => active && setEvents(j?.data?.raffleEvents ?? []));

    return () => {
      active = false;
    };
  }, [raffleId, open, initialRaffle]);

  const displayData = (state.data || initialRaffle || metadata) as any;

  /* ------------------------------ Participants ------------------------------ */

  const { participants, isLoading: loadingPart } = useRaffleParticipants(
    raffleId,
    Number(displayData?.sold || 0)
  );

  /* ------------------------------ Timeline ------------------------------ */

  const timeline = useMemo(() => {
    if (!displayData) return [];

    const steps: any[] = [];
    const find = (t: string) => (events ?? []).find((e) => e.type === t);

    const deployed = find("LOTTERY_DEPLOYED");

    steps.push({
      label: "Initialized",
      date: displayData.createdAtTimestamp || deployed?.blockTimestamp,
      tx: displayData.creationTx || deployed?.txHash,
      status: "done",
    });

    steps.push({
      label: "Registered",
      status: displayData.registeredAt ? "done" : "future",
      date: displayData.registeredAt || null,
    });

    steps.push({
      label: "Ticket Sales Open",
      status: ["OPEN", "DRAWING", "COMPLETED", "CANCELED"].includes(displayData.status)
        ? "done"
        : "future",
    });

    steps.push({
      label: "Settlement",
      status: displayData.status === "COMPLETED" ? "done" : "future",
      winner: displayData.winner,
    });

    return steps;
  }, [displayData, events]);

  // ✅ FIXED: Created on uses the SAME source as Initialized
  const createdOnTs = timeline?.[0]?.date ?? null;

  if (!open) return null;

  /* ---------------------------------- Render ---------------------------------- */

  return (
    <div className="rdm-overlay" onMouseDown={onClose}>
      <div className="rdm-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="rdm-header">
          <button className="rdm-close-btn" onClick={actions.handleShare}>🔗</button>
          <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>
            TICKET #{raffleId?.slice(2, 8).toUpperCase()}
          </div>
          <button className="rdm-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* HERO */}
        <div className="rdm-hero">
          <div className="rdm-hero-lbl">Total Prize Pool</div>
          <div className="rdm-hero-val">
            {math.fmtUsdc(displayData?.winningPot || "0")} <span style={{ fontSize: 14 }}>USDC</span>
          </div>

          <div className="rdm-host">
            <span>Created by</span>
            <ExplorerLink addr={displayData?.creator} label={math.short(displayData?.creator)} />
          </div>

          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Created on {formatDate(createdOnTs)}
          </div>
        </div>

        {/* BUY SECTION (unchanged) */}
        {/* ... your existing buy section remains untouched ... */}

        {/* TABS */}
        <div className="rdm-tab-group">
          <button className={`rdm-tab-btn ${tab === "receipt" ? "active" : ""}`} onClick={() => setTab("receipt")}>
            Lifecycle
          </button>
          <button className={`rdm-tab-btn ${tab === "holders" ? "active" : ""}`} onClick={() => setTab("holders")}>
            Top Holders
          </button>
        </div>

        {/* TAB CONTENT */}
        <div className="rdm-scroll-content">
          {tab === "receipt" && (
            <div className="rdm-receipt">
              <div className="rdm-receipt-title" style={{ marginBottom: 16 }}>
                BLOCKCHAIN JOURNEY
              </div>

              <div className="rdm-timeline">
                {timeline.map((step, i) => (
                  <div key={i} className={`rdm-tl-item ${step.status}`}>
                    <div className="rdm-tl-dot" />
                    <div className="rdm-tl-title">{step.label}</div>
                    <div className="rdm-tl-date">
                      {formatDate(step.date)} <TxLink hash={step.tx} />
                    </div>
                    {step.winner && (
                      <div className="rdm-tl-winner-box">
                        🏆 <ExplorerLink addr={step.winner} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "holders" && (
            <div className="rdm-leaderboard-section">
              <div className="rdm-lb-header">
                <span>Address</span>
                <span>Holdings</span>
              </div>
              <div className="rdm-lb-list">
                {loadingPart && <div className="rdm-lb-empty">Loading holders…</div>}
                {!loadingPart && participants.length === 0 && (
                  <div className="rdm-lb-empty">No tickets sold yet.</div>
                )}
                {!loadingPart &&
                  participants.map((p, i) => (
                    <div key={i} className="rdm-lb-row">
                      <ExplorerLink addr={p.buyer} />
                      <div>
                        {p.ticketsPurchased} 🎟 <span style={{ marginLeft: 6 }}>({p.percentage}%)</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}