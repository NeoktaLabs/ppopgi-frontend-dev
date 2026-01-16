// src/features/raffles/RaffleDetailsModal.tsx
import { useEffect } from "react";
import { Modal } from "../../ui/Modal";
import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "../../lib/subgraph";
import { QUERY_RAFFLE_DETAIL, QUERY_RAFFLE_EVENTS } from "../../lib/queries";
import { friendlyStatus } from "../../lib/format";
import { RaffleTimeline } from "./RaffleTimeline";

export function RaffleDetailsModal({
  raffleId,
  onClose,
  onOpenSafety,
  onLoadedRaffle,
}: {
  raffleId: string | null;
  onClose: () => void;
  onOpenSafety: () => void;
  onLoadedRaffle?: (raffle: any | null) => void;
}) {
  const raffleDetailQ = useQuery({
    queryKey: ["raffleDetail", raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const client = getSubgraphClient();
      return client.request(QUERY_RAFFLE_DETAIL, { id: raffleId });
    },
    retry: 1,
  });

  const raffleEventsQ = useQuery({
    queryKey: ["raffleEvents", raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const client = getSubgraphClient();
      return client.request(QUERY_RAFFLE_EVENTS, { raffle: raffleId, first: 50 });
    },
    retry: 1,
  });

  const raffle = (raffleDetailQ.data as any)?.raffle ?? null;
  const events = (raffleEventsQ.data as any)?.raffleEvents ?? [];

  // Notify parent when raffle loads / changes
  useEffect(() => {
    onLoadedRaffle?.(raffle);
  }, [raffle, onLoadedRaffle]);

  return (
    <Modal open={!!raffleId} onClose={onClose} title={raffle?.name || "Raffle"}>
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
              onClick={onOpenSafety}
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
  );
}