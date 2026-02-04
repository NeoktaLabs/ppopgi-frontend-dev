// src/components/RaffleDetailsModal.tsx
import { useState, useEffect, useMemo } from "react"; // ✅ Removed 'React'
import { useRaffleInteraction } from "../hooks/useRaffleInteraction";
import { useRaffleParticipants } from "../hooks/useRaffleParticipants";
import { fetchRaffleMetadata, type RaffleListItem } from "../indexer/subgraph";
import "./RaffleDetailsModal.css";

// Helper for clickable addresses
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
    hour: "2-digit",
    minute: "2-digit",
  });
};

type RaffleEventRow = {
  type: string;
  blockTimestamp: string;
  txHash: string;
  actor?: string | null;
  target?: string | null;
  uintValue?: string | null;
  amount?: string | null;
  amount2?: string | null;
  text?: string | null;
  requestId?: string | null;
};

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

async function fetchRaffleEvents(raffleId: string): Promise<RaffleEventRow[]> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const query = `
    query RaffleJourney($id: Bytes!, $first: Int!) {
      raffleEvents(
        first: $first
        orderBy: blockTimestamp
        orderDirection: asc
        where: { raffle: $id }
      ) {
        type
        blockTimestamp
        txHash
        actor
        target
        uintValue
        amount
        amount2
        text
        requestId
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { id: raffleId.toLowerCase(), first: 200 } }),
    });

    const json = await res.json();
    if (!res.ok || json?.errors?.length) return [];
    return (json.data?.raffleEvents ?? []) as RaffleEventRow[];
  } catch {
    return [];
  }
}

type Props = {
  open: boolean;
  raffleId: string | null;
  onClose: () => void;
  initialRaffle?: RaffleListItem | null;
};

export function RaffleDetailsModal({ open, raffleId, onClose, initialRaffle }: Props) {
  const { state, math, flags, actions } = useRaffleInteraction(raffleId, open);
  const [tab, setTab] = useState<"receipt" | "holders">("receipt");
  const [metadata, setMetadata] = useState<Partial<RaffleListItem> | null>(null);

  // NEW: events for timeline
  const [events, setEvents] = useState<RaffleEventRow[] | null>(null);

  // Self-healing metadata fetch
  useEffect(() => {
    if (!raffleId || !open) {
      setMetadata(null);
      setEvents(null);
      setTab("receipt");
      return;
    }

    if (initialRaffle?.createdAtTimestamp) setMetadata(initialRaffle);

    let active = true;

    // metadata
    if (!initialRaffle?.createdAtTimestamp) {
      fetchRaffleMetadata(raffleId).then((data) => {
        if (active && data) setMetadata(data);
      });
    }

    // events (for blockchain journey)
    fetchRaffleEvents(raffleId).then((rows) => {
      if (!active) return;
      setEvents(rows);
    });

    return () => {
      active = false;
    };
  }, [raffleId, open, initialRaffle]);

  // ✅ FIX: Cast to 'any' to avoid TS errors for properties like registeredAt/completedAt
  // that might be missing on Partial<RaffleListItem>
  const displayData = (state.data || initialRaffle || metadata) as any;

  const { participants, isLoading: loadingPart } = useRaffleParticipants(
    raffleId,
    Number(displayData?.sold || 0)
  );

  const timeline = useMemo(() => {
    if (!displayData) return [];

    const steps: any[] = [];
    const findFirst = (t: string) => (events ?? []).find((e) => e.type === t) || null;

    const deployed = findFirst("LOTTERY_DEPLOYED");
    const registered = findFirst("LOTTERY_REGISTERED");
    const funding = findFirst("FUNDING_CONFIRMED");
    const finalized = findFirst("LOTTERY_FINALIZED");
    const winner = findFirst("WINNER_PICKED");
    const canceled = findFirst("LOTTERY_CANCELED");

    // 1) Initialized
    steps.push({
      label: "Initialized",
      date: displayData.createdAtTimestamp || deployed?.blockTimestamp || null,
      tx: displayData.creationTx || deployed?.txHash || null,
      status: "done",
    });

    // 2) Registered
    if (registered) {
      steps.push({
        label: "Registered",
        date: registered.blockTimestamp,
        tx: registered.txHash,
        status: "done",
      });
    } else if (displayData.registeredAt) {
      steps.push({
        label: "Registered",
        date: displayData.registeredAt,
        tx: null,
        status: "done",
      });
    } else {
      steps.push({
        label: "Registered",
        date: null,
        tx: null,
        status: "future",
      });
    }

    const status = displayData.status;

    // 3) Sales Open
    if (funding) {
      steps.push({
        label: "Ticket Sales Open",
        date: funding.blockTimestamp,
        tx: funding.txHash,
        status: "done",
      });
    } else {
      const s =
        status === "OPEN" || status === "DRAWING" || status === "COMPLETED" || status === "CANCELED"
          ? "active"
          : "future";
      steps.push({
        label: "Ticket Sales Open",
        date: null,
        tx: null,
        status: s,
      });
    }

    // 4) Randomness
    if (finalized) {
      steps.push({
        label: "Randomness Requested",
        date: finalized.blockTimestamp,
        tx: finalized.txHash,
        status: "done",
      });
    } else if (status === "DRAWING") {
      steps.push({
        label: "Randomness Requested",
        date: null,
        tx: null,
        status: "active",
      });
    } else {
      steps.push({
        label: "Draw Deadline",
        date: displayData.deadline || null,
        tx: null,
        status: status === "OPEN" ? "active" : "future",
      });
    }

    // 5) Settlement
    if (winner) {
      steps.push({
        label: "Winner Selected",
        date: winner.blockTimestamp,
        tx: winner.txHash,
        status: "done",
        winner: displayData.winner || winner.actor || null,
      });
    } else if (canceled) {
      steps.push({
        label: "Canceled",
        date: canceled.blockTimestamp,
        tx: canceled.txHash,
        status: "done",
      });
    } else if (status === "COMPLETED") {
      steps.push({
        label: "Winner Selected",
        date: displayData.completedAt || null,
        tx: null,
        status: "done",
        winner: displayData.winner || null,
      });
    } else if (status === "CANCELED") {
      steps.push({
        label: "Canceled",
        date: displayData.canceledAt || null,
        tx: null,
        status: "done",
      });
    } else {
      steps.push({
        label: "Settlement",
        date: null,
        tx: null,
        status: "future",
      });
    }

    return steps;
  }, [displayData, events]);

  // Stats
  const stats = useMemo(() => {
    if (!displayData) return null;
    const pot = parseFloat(math.fmtUsdc(displayData.winningPot || "0"));
    const price = parseFloat(math.fmtUsdc(displayData.ticketPrice || "0"));
    const sold = Number(displayData.sold || "0");
    const roi = price > 0 ? (pot / price).toFixed(1) : "0";
    const odds = sold > 0 ? `1 in ${sold + 1}` : "100%";
    return { roi, odds, pot, price };
  }, [displayData, math]);

  if (!open) return null;

  return (
    <div className="rdm-overlay" onMouseDown={onClose}>
      <div className="rdm-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="rdm-header">
          <div style={{ display: "flex", gap: 8 }}>
            <button className="rdm-close-btn" onClick={actions.handleShare} title="Copy Link">
              🔗
            </button>
          </div>
          <div style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            TICKET #{raffleId?.slice(2, 8).toUpperCase()}
          </div>
          <button className="rdm-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* HERO */}
        <div className="rdm-hero">
          <div className="rdm-hero-lbl">Current Prize Pot</div>
          <div className="rdm-hero-val">{math.fmtUsdc(displayData?.winningPot || "0")}</div>
          <div className="rdm-host">
            <span>Hosted by</span>
            <ExplorerLink
              addr={String(displayData?.creator || "")}
              label={math.short(String(displayData?.creator || ""))}
            />
          </div>
        </div>

        {/* STATS */}
        {stats && (
          <div className="rdm-stats-grid">
            <div className="rdm-stat-box highlight">
              <div className="rdm-sb-lbl">Payout</div>
              <div className="rdm-sb-val rdm-roi-badge">{stats.roi}x</div>
            </div>
            <div className="rdm-stat-box">
              <div className="rdm-sb-lbl">Win Odds</div>
              <div className="rdm-sb-val">{stats.odds}</div>
            </div>
            <div className="rdm-stat-box">
              <div className="rdm-sb-lbl">Price</div>
              <div className="rdm-sb-val">${stats.price}</div>
            </div>
          </div>
        )}

        <div className="rdm-tear" />

        {/* BUY SECTION */}
        <div className="rdm-buy-section">
          {!flags.raffleIsOpen ? (
            <div style={{ textAlign: "center", padding: 20, opacity: 0.6, fontWeight: 700 }}>
              {state.displayStatus === "Open" ? "Raffle is finalizing..." : "Raffle Closed"}
            </div>
          ) : (
            <>
              <div className="rdm-balance-row">
                <span>Bal: {math.fmtUsdc(state.usdcBal?.toString() || "0")}</span>
                <span>Max: {math.maxBuy} Tickets</span>
              </div>
              <div className="rdm-stepper">
                <button className="rdm-step-btn" onClick={() => actions.setTickets(String(math.ticketCount - 1))}>
                  −
                </button>
                <div className="rdm-input-wrapper">
                  <input
                    className="rdm-amount"
                    value={state.tickets}
                    onChange={(e) => actions.setTickets(e.target.value)}
                    placeholder="1"
                  />
                  <div className="rdm-cost-preview">Total: {math.fmtUsdc(math.totalCostU.toString())} USDC</div>
                </div>
                <button className="rdm-step-btn" onClick={() => actions.setTickets(String(math.ticketCount + 1))}>
                  +
                </button>
              </div>
              {!flags.hasEnoughAllowance ? (
                <button className="rdm-cta approve" onClick={actions.approve} disabled={state.isPending}>
                  {state.isPending ? "Approving..." : "1. Approve USDC"}
                </button>
              ) : (
                <button className="rdm-cta buy" onClick={actions.buy} disabled={!flags.canBuy || state.isPending}>
                  {state.isPending ? "Confirming..." : `Buy ${state.tickets} Ticket${math.ticketCount !== 1 ? "s" : ""}`}
                </button>
              )}
              {state.buyMsg && (
                <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#D32F2F", fontWeight: 700 }}>
                  {state.buyMsg}
                </div>
              )}
            </>
          )}
        </div>

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
              <div className="rdm-receipt-title" style={{ marginBottom: 0 }}>
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
                        <span>🏆 Winner:</span> <ExplorerLink addr={step.winner} />
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
                {loadingPart && <div className="rdm-lb-empty">Loading holders...</div>}
                {!loadingPart && participants.length === 0 && <div className="rdm-lb-empty">No tickets sold yet.</div>}
                {!loadingPart &&
                  participants.map((p, i) => (
                    <div key={i} className="rdm-lb-row">
                      <span className="rdm-lb-addr">
                        <ExplorerLink addr={p.buyer} />
                      </span>
                      <div className="rdm-lb-stats">
                        <span className="rdm-lb-count">{p.ticketsPurchased} 🎟</span>
                        <span className="rdm-lb-pct">({p.percentage}%)</span>
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
