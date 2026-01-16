// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { PageModal } from "./ui/PageModal";

import { Navbar } from "./features/navbar/Navbar";
import { DisclaimerGate } from "./features/disclaimer/DisclaimerGate";
import { CreateRaffleModal } from "./features/create/CreateRaffleModal";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { CashierModal } from "./features/cashier/CashierModal";

import { HomePage } from "./features/home/HomePage";
import { RaffleDetailsModal } from "./features/raffles/RaffleDetailsModal";

export default function App() {
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const [openRaffleId, setOpenRaffleId] = useState<string | null>(null);

  // Used to force a re-render after disclaimer acceptance (simple + reliable)
  const [disclaimerTick, setDisclaimerTick] = useState(0);

  // Subscribe to wallet state so the UI reacts immediately after connect
  const acc = useAccount();

  // Track which raffle we already applied creator for (prevents needless setState loops)
  // (kept because your RaffleDetailsModal still calls onLoadedRaffle)
  const loadedRaffleIdRef = useRef<string | null>(null);

  // shared link support: /#raffle=0x...
  const raffleFromHash = useMemo(() => {
    const m = window.location.hash.match(/raffle=([^&]+)/);
    return m ? decodeURIComponent(m[1]).toLowerCase() : null;
  }, [disclaimerTick, acc.address]);

  useEffect(() => {
    if (raffleFromHash) setOpenRaffleId(raffleFromHash);
  }, [raffleFromHash]);

  const anyOverlayOpen = !!openRaffleId || createOpen || dashboardOpen;

  function openRaffle(id: string) {
    const lower = id.toLowerCase();
    window.location.hash = `raffle=${encodeURIComponent(lower)}`;
    setOpenRaffleId(lower);

    loadedRaffleIdRef.current = null;
  }

  function closeRaffle() {
    setOpenRaffleId(null);
    window.location.hash = "";
    loadedRaffleIdRef.current = null;
  }

  return (
    <div className="min-h-screen pb-12 relative">
      <DisclaimerGate onAccept={() => setDisclaimerTick((x) => x + 1)} />

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

      <div className="pt-24" />

      <div
        className={`transition-all duration-300 ${
          anyOverlayOpen ? "scale-[0.98] blur-[2px] opacity-50 pointer-events-none" : ""
        }`}
      >
        <HomePage
          onOpenRaffle={openRaffle}
          onOpenSafety={(raffleId) => {
            // Now: just open the raffle; Safety modal is inside RaffleDetailsModal
            openRaffle(raffleId);
          }}
        />
      </div>

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
              openRaffle(id);
            }}
          />
        </PageModal>
      )}

      <RaffleDetailsModal
        raffleId={openRaffleId}
        onClose={closeRaffle}
        // Safety is handled inside RaffleDetailsModal now
        onOpenSafety={() => {}}
        onLoadedRaffle={(r) => {
          // Optional: keep this only if something else needs it later
          if (!openRaffleId) return;
          if (loadedRaffleIdRef.current === openRaffleId) return;
          loadedRaffleIdRef.current = openRaffleId;

          // no-op currently; you can delete onLoadedRaffle entirely later
          void r;
        }}
      />

      <CashierModal isOpen={cashierOpen} onClose={() => setCashierOpen(false)} />

      <CreateRaffleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => {}} />
    </div>
  );
}