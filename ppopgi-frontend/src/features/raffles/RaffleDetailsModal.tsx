// src/features/raffles/RaffleDetailsModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";

import { Modal } from "../../ui/Modal";
import { getSubgraphClient } from "../../lib/subgraph";
import { QUERY_RAFFLE_DETAIL, QUERY_RAFFLE_EVENTS } from "../../lib/queries";
import { friendlyStatus } from "../../lib/format";
import { ADDR, LOTTERY_SINGLE_WINNER_ABI } from "../../lib/contracts";

import { RaffleTimeline } from "./RaffleTimeline";
import { RaffleActionsModal } from "../dashboard/RaffleActionsModal";
import { RaffleSafetyModal } from "./RaffleSafetyModal";

// ✅ helpers
import { useNowTick } from "../../lib/useNowTick";
import { endsInText } from "../../lib/endsInText";

export function RaffleDetailsModal({
  raffleId,
  onClose,
  onOpenSafety,
  onLoadedRaffle,
}: {
  raffleId: string | null;
  onClose: () => void;

  /**
   * Optional legacy callback (ex: App-level modal routing / analytics).
   * This component now opens RaffleSafetyModal locally.
   */
  onOpenSafety?: () => void;

  onLoadedRaffle?: (raffle: any | null) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

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

  useEffect(() => {
    onLoadedRaffle?.(raffle);
  }, [raffle, onLoadedRaffle]);

  // If raffle closes, ensure sub-modals close too (prevents stale open state)
  useEffect(() => {
    if (!raffleId) {
      setActionsOpen(false);
      setSafetyOpen(false);
    }
  }, [raffleId]);

  // ✅ One ticking clock for this modal
  const nowMs = useNowTick(!!raffleId, 30_000);

  // ✅ time-based ended (independent from subgraph lag)
  const deadlineSec = Number(raffle?.deadline ?? 0);
  const hasDeadline = Number.isFinite(deadlineSec) && deadlineSec > 0;
  const endedByTime = hasDeadline ? deadlineSec * 1000 <= nowMs : false;

  // ✅ label ("Ends in ..." OR "Ended" OR "—")
  const endsLabel = raffle ? endsInText(deadlineSec, nowMs) : "—";

  // ✅ UI gating (buy should NOT be possible after deadline)
  const statusUpper = String(raffle?.status ?? "").toUpperCase();
  const canBuyUi =
    !!raffle && statusUpper === "OPEN" && !raffle.paused && !endedByTime;

  // ✅ Better “state line” for the user while subgraph catches up
  const stateLine = useMemo(() => {
    if (!raffle) return null;

    if (raffle.paused) return "Paused — buying disabled.";

    if (statusUpper === "DRAWING") return "Draw is happening…";
    if (statusUpper === "COMPLETED") return "Completed.";
    if (statusUpper === "CANCELED" || statusUpper === "CANCELLED") return "Canceled.";

    // Subgraph may still say OPEN for a short while after deadline
    if (statusUpper === "OPEN" && endedByTime) return "Raffle ended — awaiting draw…";

    // Normal open state
    if (statusUpper === "OPEN") return endsLabel;

    return endsLabel;
  }, [raffle, statusUpper, endedByTime, endsLabel]);

  // Unverified / caution (RPC check; only when raffle exists and modal is open)
  const rDeployer = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "deployer",
    query: { enabled: !!raffleId && !!raffle },
  });

  const isOfficial = useMemo(() => {
    const dep = rDeployer.data ? String(rDeployer.data).toLowerCase() : "";
    return dep && dep === ADDR.deployer.toLowerCase();
  }, [rDeployer.data]);

  return (
    <>
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
          <div style={{ display: "grid", gap: 10 }}>
            {!isOfficial && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: "rgba(255, 210, 120, 0.18)",
                  fontWeight: 900,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 1000 }}>Unverified / use caution</div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                  This raffle was not created from the official Ppopgi site (it does not match the
                  official deployer).
                </div>
              </div>
            )}

            {/* Status pill */}
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

            {/* ✅ State line */}
            <div style={{ fontWeight: 900, opacity: 0.85 }}>{stateLine}</div>

            {/* Top actions */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setActionsOpen(true)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.50)",
                  background: "rgba(255,255,255,0.20)",
                  cursor: "pointer",
                  fontWeight: 1000,
                }}
              >
                Actions
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenSafety?.();
                  setSafetyOpen(true);
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
                Safety &amp; Proof
              </button>

              {/* ✅ Optional: show a disabled “Buying closed” pill-button (nice UX) */}
              {!canBuyUi ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.10)",
                    fontWeight: 1000,
                    opacity: 0.75,
                  }}
                  title="Buying is disabled"
                >
                  Buying closed
                </div>
              ) : null}
            </div>

            {/* Stats */}
            <div style={{ marginTop: 2 }}>Ticket: {raffle.ticketPrice} USDC</div>
            <div>Win: {raffle.winningPot} USDC</div>
            <div>Joined: {raffle.sold}</div>

            {/* ✅ Explainer for ended-but-not-finalized window */}
            {statusUpper === "OPEN" && endedByTime ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                This raffle reached its deadline. Your bot will finalize it shortly.
              </div>
            ) : null}

            {raffle.winner ? (
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
            ) : null}

            <div style={{ marginTop: 10 }}>
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

            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              This view is fast. Before any action, we confirm live on-chain values.
            </div>

            {/* ✅ dev-friendly note: you can pass canBuyUi down once your buy UI exists */}
            <div style={{ marginTop: 2, fontSize: 11, opacity: 0.55 }}>
              UI buy enabled: {String(canBuyUi)}
            </div>
          </div>
        )}
      </Modal>

      <RaffleActionsModal
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        raffleId={raffleId ?? ""}
        raffleName={raffle?.name}
      />

      <RaffleSafetyModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        raffleId={raffleId}
        raffle={raffle}
      />
    </>
  );
}