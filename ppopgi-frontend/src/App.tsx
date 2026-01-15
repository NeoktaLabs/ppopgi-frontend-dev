import { useEffect, useMemo, useState } from "react";
import { Modal } from "./ui/Modal";
import { useBigPrizes, useEndingSoon } from "./features/raffles/useRafflesHome";
import { RaffleCard } from "./features/raffles/RaffleCard";
import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "./lib/subgraph";
import { QUERY_RAFFLE_DETAIL } from "./lib/queries";

export default function App() {
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [openRaffleId, setOpenRaffleId] = useState<string | null>(null);

  // shared link support: /#raffle=0x...
  const raffleFromHash = useMemo(() => {
    const m = window.location.hash.match(/raffle=([^&]+)/);
    return m ? decodeURIComponent(m[1]).toLowerCase() : null;
  }, []);

  useEffect(() => {
    if (raffleFromHash) setOpenRaffleId(raffleFromHash);
  }, [raffleFromHash]);

  const big = useBigPrizes();
  const soon = useEndingSoon();

  const raffleDetailQ = useQuery({
    queryKey: ["raffleDetail", openRaffleId],
    enabled: !!openRaffleId,
    queryFn: async () => {
      const client = getSubgraphClient();
      return client.request(QUERY_RAFFLE_DETAIL, { id: openRaffleId });
    },
    retry: 1,
  });

  const raffle = (raffleDetailQ.data as any)?.raffle;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 16 }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
        <div style={{ fontWeight: 1000, letterSpacing: 0.2 }}>Ppopgi</div>

        <div style={{ display: "flex", gap: 12, marginLeft: 10 }}>
          <button style={linkBtn()}>Explore</button>
          <button style={linkBtn()} onClick={() => setCreateOpen(true)}>
            Create
          </button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button style={pillBtn()} onClick={() => setCashierOpen(true)}>
            Cashier
          </button>
          <button style={pillBtn()}>Sign in</button>
        </div>
      </div>

      {/* Home sections */}
      <div style={{ display: "grid", gap: 18, marginTop: 12 }}>
        <section style={panel()}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Big prizes right now</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            The biggest rewards you can win today.
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {big.isLoading && <div>Loading…</div>}
            {big.error && (
              <div style={{ fontWeight: 800 }}>
                Loading directly from the network… This may take a moment.
              </div>
            )}
            {(big.data?.raffles ?? []).map((r) => (
              <RaffleCard
                key={r.id}
                raffle={r}
                onOpen={(id) => {
                  const lower = id.toLowerCase();
                  window.location.hash = `raffle=${encodeURIComponent(lower)}`;
                  setOpenRaffleId(lower);
                }}
              />
            ))}
          </div>
        </section>

        <section style={panel()}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Ending soon</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>Last chance to join.</div>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {soon.isLoading && <div>Loading…</div>}
            {soon.error && (
              <div style={{ fontWeight: 800 }}>
                Loading directly from the network… This may take a moment.
              </div>
            )}
            {(soon.data?.raffles ?? []).map((r) => (
              <RaffleCard
                key={r.id}
                raffle={r}
                onOpen={(id) => {
                  const lower = id.toLowerCase();
                  window.location.hash = `raffle=${encodeURIComponent(lower)}`;
                  setOpenRaffleId(lower);
                }}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Raffle modal (subgraph-first detail) */}
      <Modal
        open={!!openRaffleId}
        onClose={() => {
          setOpenRaffleId(null);
          window.location.hash = "";
        }}
        title={raffle?.name || "Raffle"}
      >
        {raffleDetailQ.isLoading ? (
          <div>Loading…</div>
        ) : raffleDetailQ.error ? (
          <div style={{ fontWeight: 800 }}>
            Loading directly from the network… This may take a moment.
          </div>
        ) : !raffle ? (
          <div style={{ fontWeight: 800 }}>
            We couldn’t find this raffle right now.
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              This can happen if the fast view is behind. You can try again in a moment.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <div>
              Status: {raffle.status}
              {raffle.paused ? " (paused)" : ""}
            </div>
            <div>Ticket: {raffle.ticketPrice} USDC</div>
            <div>Win: {raffle.winningPot} USDC</div>
            <div>Joined: {raffle.sold}</div>

            {raffle.winner && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 900 }}>Winner</div>
                <div>{raffle.winner}</div>
                <div>Winning ticket: {raffle.winningTicketIndex}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cashier modal */}
      <Modal open={cashierOpen} onClose={() => setCashierOpen(false)} title="Cashier">
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>What you need</div>
          <ul>
            <li>Energy coins (XTZ) for energy costs and the draw step.</li>
            <li>Coins (USDC) to buy tickets.</li>
          </ul>
        </div>
      </Modal>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create">
        <div style={{ lineHeight: 1.6 }}>
          Create will be wired after we add the factory contract.
        </div>
      </Modal>
    </div>
  );
}

function linkBtn(): React.CSSProperties {
  return {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 800,
    padding: "8px 10px",
    borderRadius: 12,
  };
}

function pillBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.20)",
    cursor: "pointer",
    fontWeight: 900,
    padding: "8px 12px",
    borderRadius: 999,
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(14px)",
    padding: 14,
  };
}