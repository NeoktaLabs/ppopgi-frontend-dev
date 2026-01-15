// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Ticket, Store, Compass, LogOut, Wallet, LayoutDashboard } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";

import { Modal } from "./ui/Modal";
import { PageModal } from "./ui/PageModal";
import { useBigPrizes, useEndingSoon } from "./features/raffles/useRafflesHome";
import { RaffleCard } from "./features/raffles/RaffleCard";
import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "./lib/subgraph";
import { QUERY_RAFFLE_DETAIL, QUERY_RAFFLE_EVENTS } from "./lib/queries";
import { DisclaimerGate } from "./features/disclaimer/DisclaimerGate";
import { friendlyStatus } from "./lib/format";
import { RaffleTimeline } from "./features/raffles/RaffleTimeline";
import { SafetyProofModal } from "./features/safety/SafetyProofModal";
import { WalletPill } from "./features/wallet/WalletPill";
import { CreateRaffleModal } from "./features/create/CreateRaffleModal";
import { NetworkBanner } from "./features/wallet/NetworkBanner";
import { DashboardPage } from "./features/dashboard/DashboardPage";

export default function App() {
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const [openRaffleId, setOpenRaffleId] = useState<string | null>(null);

  const [disclaimerTick, setDisclaimerTick] = useState(0);
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

      <Navbar
        onOpenCashier={() => setCashierOpen(true)}
        onOpenCreate={() => setCreateOpen(true)}
        onOpenDashboard={() => setDashboardOpen(true)}
      />

      <div className="pt-20">
        <NetworkBanner />
      </div>

      <div
        className={`transition-all duration-300 ${
          anyOverlayOpen ? "scale-[0.98] blur-[2px] opacity-50 pointer-events-none" : ""
        }`}
      >
        <main className="container mx-auto px-4 pt-6 max-w-[100rem] animate-fade-in">
          {/* Big prizes */}
          <div className="w-fit mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-6 border border-white/30 shadow-lg relative overflow-visible mt-6">
            <div className="flex items-center gap-3 mb-2 pl-1">
              <div className="p-2 rounded-xl bg-yellow-400 text-white shadow-md rotate-[-6deg]">
                <Ticket size={20} strokeWidth={3} />
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

          {/* Ending soon */}
          <div className="w-fit mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-10 border border-white/30 shadow-lg relative overflow-visible">
            <div className="flex items-center gap-3 mb-2 pl-1">
              <div className="p-2 rounded-xl bg-red-400 text-white shadow-md rotate-[-6deg]">
                <Compass size={20} strokeWidth={3} />
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
        <PageModal
          onClose={() => {
            setDashboardOpen(false);
          }}
        >
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

      {/* Raffle modal */}
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

      <SafetyProofModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        raffleId={openRaffleId ?? ""}
        creator={raffle?.creator}
      />

      <Modal open={cashierOpen} onClose={() => setCashierOpen(false)} title="Cashier">
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>What you need</div>
          <ul>
            <li>Energy coins (XTZ) for energy costs and the draw step.</li>
            <li>Coins (USDC) to buy tickets.</li>
          </ul>
        </div>
      </Modal>

      <CreateRaffleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {}}
      />
    </div>
  );
}

function Navbar({
  onOpenCashier,
  onOpenCreate,
  onOpenDashboard,
}: {
  onOpenCashier: () => void;
  onOpenCreate: () => void;
  onOpenDashboard: () => void;
}) {
  const { disconnect } = useDisconnect();

  return (
    <nav className="w-full h-20 bg-white/85 backdrop-blur-md border-b border-white/50 fixed top-0 z-50 flex items-center justify-between px-4 md:px-8 shadow-sm">
      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, openChainModal, mounted }) => {
          const connected = mounted && account && chain;

          return (
            <>
              {/* Left */}
              <div className="flex items-center gap-6">
                <div
                  className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => {
                    window.location.hash = "";
                  }}
                >
                  <div className="w-9 h-9 bg-[#FFD700] rounded-full flex items-center justify-center text-white font-bold shadow-inner border-2 border-white">
                    <Ticket size={18} className="text-amber-700" />
                  </div>
                  <span className="font-bold text-xl text-amber-800 tracking-tight hidden md:block">
                    Ppopgi
                  </span>
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={() => {}}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Compass size={16} /> Explore
                  </button>

                  <button
                    onClick={() => (connected ? onOpenCreate() : openConnectModal())}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm text-gray-600 hover:text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    <Ticket size={16} /> Create
                  </button>
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-gray-50/80 p-1.5 pr-2 rounded-2xl border border-gray-200/60 shadow-inner">
                  <div className="hidden lg:block pl-1">
                    <WalletPill />
                  </div>

                  <button
                    onClick={onOpenCashier}
                    className="bg-amber-500 hover:bg-amber-600 text-white p-2 md:px-4 md:py-2.5 rounded-xl font-bold shadow-sm active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 text-xs md:text-sm h-full"
                  >
                    <Store size={18} />
                    <span className="hidden md:inline">Cashier</span>
                  </button>
                </div>

                {connected ? (
                  <div className="flex items-center gap-2">
                    {chain?.unsupported ? (
                      <button
                        onClick={openChainModal}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold shadow-sm text-sm"
                      >
                        Wrong network
                      </button>
                    ) : (
                      <button
                        onClick={openChainModal}
                        className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-100 px-4 py-2 rounded-xl font-bold shadow-sm text-sm transition-colors"
                        title="Switch network"
                      >
                        Network
                      </button>
                    )}

                    <button
                      onClick={onOpenDashboard}
                      className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-100 px-4 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 text-sm transition-colors"
                      title="Open Dashboard"
                    >
                      <LayoutDashboard size={16} />
                      {account?.address ? `Player ...${account.address.slice(-4)}` : "Player"}
                    </button>

                    <button
                      onClick={() => disconnect()}
                      className="bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 p-2.5 rounded-xl transition-colors border border-transparent hover:border-red-100"
                      title="Disconnect Wallet"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={openConnectModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-[0_4px_0_0_#1e3a8a] active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 text-sm"
                  >
                    <Wallet size={18} />
                    <span className="hidden md:inline">Join the Park</span>
                    <span className="md:hidden">Join</span>
                  </button>
                )}
              </div>
            </>
          );
        }}
      </ConnectButton.Custom>
    </nav>
  );
}