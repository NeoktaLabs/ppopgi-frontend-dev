// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { Modal } from "./ui/Modal";
import { PageModal } from "./ui/PageModal";

import { Navbar } from "./features/navbar/Navbar";
import { useBigPrizes, useEndingSoon } from "./features/raffles/useRafflesHome";
import { RaffleCard } from "./features/raffles/RaffleCard";

import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "./lib/subgraph";
import { QUERY_RAFFLE_DETAIL, QUERY_RAFFLE_EVENTS } from "./lib/queries";

import { DisclaimerGate } from "./features/disclaimer/DisclaimerGate";
import { friendlyStatus } from "./lib/format";
import { RaffleTimeline } from "./features/raffles/RaffleTimeline";
import { SafetyProofModal } from "./features/safety/SafetyProofModal";
import { CreateRaffleModal } from "./features/create/CreateRaffleModal";
import { NetworkBanner } from "./features/wallet/NetworkBanner";
import { DashboardPage } from "./features/dashboard/DashboardPage";

export default function App() {
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

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

  const anyOverlayOpen = !!openRaffleId || createOpen || safetyOpen || dashboardOpen;

  return (
    <div className="min-h-screen pb-12 relative">
      <DisclaimerGate onAccept={() => setDisclaimerTick((x) => x + 1)} />

      {/* Rounded centered navbar (extracted) */}
      <Navbar
        onOpenCashier={() => setCashierOpen(true)}
        onOpenCreate={() => setCreateOpen(true)}
        onOpenDashboard={() => setDashboardOpen(true)}
        onGoHome={() => {
          window.location.hash = "";
        }}
        onGoExplore={() => {
          // TODO: Explore page later (for now keep home)
        }}
      />

      {/* Give space under fixed navbar */}
      <div className="pt-24 px-4">
        <div className="mx-auto max-w-6xl">
          <NetworkBanner />
        </div>
      </div>

      {/* MAIN (blur/scale when overlays open) */}
      <div
        className={`transition-all duration-300 ${
          anyOverlayOpen ? "scale-[0.98] blur-[2px] opacity-50 pointer-events-none" : ""
        }`}
      >
        <main className="container mx-auto px-4 pt-2 max-w-[100rem] animate-fade-in">
          {/* SECTION: Big prizes */}
          <div className="w-fit mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-6 border border-white/30 shadow-lg relative overflow-visible mt-6">
            <div className="flex items-center gap-3 mb-2 pl-1">
              <div className="p-2 rounded-xl bg-yellow-400 text-white shadow-md rotate-[-6deg]">
                {/* icon via emoji to avoid importing lucide here */}
                <span className="text-lg">🎟️</span>
              </div>
              <h2 className="text-2xl font-black text-gray-800/90 tracking-tight uppercase drop-shadow-sm">
                Big prizes right now
              </h2>
            </div>
            <p className="text-gray-600 font-bold text-xs md:text-sm leading-relaxed max-w-2xl pl-1">
              The biggest rewards you can win today.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-items-center">
              {big.isLoading && (
                <div className="text-white font-bold opacity-80 py-10">Loading…</div>
              )}

              {big.error && (
                <div className="text-white font-bold opacity-90 py-10">
                  Loading directly from the network… This may take a moment.
                </div>
              )}

              {(big.data?.raffles ?? []).map((r) => (
                <div key={r.id} className="w-full flex justify-center">
                  <RaffleCard
                    raffle={r}
                    onOpen={(id) => {
                      const lower = id.toLowerCase();
                      window.location.hash = `raffle=${encodeURIComponent(lower)}`;
                      setOpenRaffleId(lower);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SECTION: Ending soon */}
          <div className="w-fit mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-10 border border-white/30 shadow-lg relative overflow-visible">
            <div className="flex items-center gap-3 mb-2 pl-1">
              <div className="p-2 rounded-xl bg-red-400 text-white shadow-md rotate-[-6deg]">
                <span className="text-lg">🧭</span>
              </div>
              <h2 className="text-2xl font-black text-gray-800/90 tracking-tight uppercase drop-shadow-sm">
                Ending soon
              </h2>
            </div>
            <p className="text-gray-600 font-bold text-xs md:text-sm leading-relaxed max-w-2xl pl-1">
              Last chance to join.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-items-center">
              {soon.isLoading && (
                <div className="text-white font-bold opacity-80 py-10">Loading…</div>
              )}

              {soon.error && (
                <div className="text-white font-bold opacity-90 py-10">
                  Loading directly from the network… This may take a moment.
                </div>
              )}

              {(soon.data?.raffles ?? []).map((r) => (
                <div key={r.id} className="w-full flex justify-center">
                  <RaffleCard
                    raffle={r}
                    onOpen={(id) => {
                      const lower = id.toLowerCase();
                      window.location.hash = `raffle=${encodeURIComponent(lower)}`;
                      setOpenRaffleId(lower);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Dashboard overlay */}
      {dashboardOpen && (
        <PageModal onClose={() => setDashboardOpen(false)}>
          <DashboardPage
            onClose={() => setDashboardOpen(false)}
            onOpenCreate={() => {
              setDashboardOpen(false);
              setCreateOpen(true);
            }}
            onOpenRaffle={(id) => {
              setDashboardOpen(false);
              window.location.hash = `raffle=${encodeURIComponent(id.toLowerCase())}`;
              setOpenRaffleId(id.toLowerCase());
            }}
          />
        </PageModal>
      )}

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

      {/* Cashier modal (placeholder content for now) */}
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
      <CreateRaffleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => {}} />
    </div>
  );
}