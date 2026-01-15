// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { Modal } from "./ui/Modal";
import { useBigPrizes, useEndingSoon } from "./features/raffles/useRafflesHome";
import { RaffleCard } from "./features/raffles/RaffleCard";
import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "./lib/subgraph";
import { QUERY_RAFFLE_DETAIL, QUERY_RAFFLE_EVENTS } from "./lib/queries";
import { DisclaimerGate } from "./features/disclaimer/DisclaimerGate";
import { friendlyStatus } from "./lib/format";
import { RaffleTimeline } from "./features/raffles/RaffleTimeline";
import { SafetyProofModal } from "./features/safety/SafetyProofModal";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletPill } from "./features/wallet/WalletPill";
import { CreateRaffleModal } from "./features/create/CreateRaffleModal";
import { NetworkBanner } from "./features/wallet/NetworkBanner";
import { useAccount } from "wagmi";

export default function App() {
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const [openRaffleId, setOpenRaffleId] = useState<string | null>(null);

  // Used to force a re-render after disclaimer acceptance (simple + reliable)
  const [disclaimerTick, setDisclaimerTick] = useState(0);

  // Subscribe to wallet state so the UI reacts immediately after connect
  const acc = useAccount();

  // shared link support: /#raffle=0x...
  const raffleFromHash = useMemo(() => {
    const m = window.location.hash.match(/raffle=([^&]+)/);
    return m ? decodeURIComponent(m[1]).toLowerCase() : null;
  }, [disclaimerTick, acc.address]);

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

  const raffleEventsQ = useQuery({
    queryKey: ["raffleEvents", openRaffleId],
    enabled: !!openRaffleId,
    queryFn: async () => {
      const client = getSubgraphClient();
      return client.request(QUERY_RAFFLE_EVENTS, { raffle: openRaffleId, first: 50 });
    },
    retry: 1,
  });

  const raffle = (raffleDetailQ.data as any)?.raffle;
  const events = (raffleEventsQ.data as any)?.raffleEvents ?? [];

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 16 }}>
      <DisclaimerGate onAccept={() => setDisclaimerTick((x) => x + 1)} />

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 14px",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 10px 34px rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ fontWeight: 1000, letterSpacing: 0.2 }}>Ppopgi</div>

        <div style={{ display: "flex", gap: 12, marginLeft: 10 }}>
          <button style={linkBtn()}>Explore</button>
          <button style={linkBtn()} onClick={() => setCreateOpen(true)}>
            Create
          </button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <WalletPill />
          <button style={pillBtn()} onClick={() => setCashierOpen(true)}>
            Cashier
          </button>
          <ConnectButton />
        </div>
      </div>

      {/* Calm network mismatch banner */}
      <NetworkBanner />

      {/* Home sections */}
      <div style={{ display: "grid", gap: 18, marginTop: 16 }}>
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
          setSafetyOpen(false);
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
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px dashed rgba(255,255,255,0.55)",
                background: "rgba(169,212,255,0.18)",
                fontWeight: 900,
                width: "fit-content",
              }}
            >
              {friendlyStatus(raffle.status)}
              {raffle.paused ? " (paused)" : ""}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setSafetyOpen(true)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.50)",
                  background: "rgba(255,255,255,0.20)",
                  cursor: "pointer",
                  fontWeight: 1000,
                }}
              >
                Safety &amp; Proof
              </button>
            </div>

            <div style={{ marginTop: 8 }}>Ticket: {raffle.ticketPrice} USDC</div>
            <div>Win: {raffle.winningPot} USDC</div>
            <div>Joined: {raffle.sold}</div>

            {raffle.winner && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: "rgba(255,255,255,0.18)",
                }}
              >
                <div style={{ fontWeight: 900 }}>Winner</div>
                <div style={{ marginTop: 4 }}>{raffle.winner}</div>
                <div style={{ marginTop: 4, opacity: 0.9 }}>
                  Winning ticket: {raffle.winningTicketIndex}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Timeline</div>
              {raffleEventsQ.isLoading ? (
                <div>Loading…</div>
              ) : raffleEventsQ.error ? (
                <div style={{ fontWeight: 800, opacity: 0.9 }}>
                  This timeline may be slightly behind.
                </div>
              ) : (
                <RaffleTimeline events={events} />
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              This view is fast. Before any action, we’ll confirm live data.
            </div>
          </div>
        )}
      </Modal>

      {/* Safety & Proof modal */}
      <SafetyProofModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        raffleId={openRaffleId ?? ""}
        creator={raffle?.creator}
      />

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

      {/* Create raffle modal */}
      <CreateRaffleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          // Next step: auto-open created raffle
        }}
      />
    </div>
  );
}

function linkBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.0)",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 900,
    padding: "8px 10px",
    borderRadius: 12,
  };
}

function pillBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.45)",
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
    boxShadow: "0 10px 34px rgba(0,0,0,0.08)",
    padding: 14,
  };
}