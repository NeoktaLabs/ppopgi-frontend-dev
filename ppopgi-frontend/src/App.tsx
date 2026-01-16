// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { PageModal } from "./ui/PageModal";

import { Navbar } from "./features/navbar/Navbar";
import { DisclaimerGate } from "./features/disclaimer/DisclaimerGate";
import { SafetyProofModal } from "./features/safety/SafetyProofModal";
import { CreateRaffleModal } from "./features/create/CreateRaffleModal";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { CashierModal } from "./features/cashier/CashierModal";

import { HomePage } from "./features/home/HomePage";
import { RaffleDetailsModal } from "./features/raffles/RaffleDetailsModal";

export default function App() {
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const [openRaffleId, setOpenRaffleId] = useState<string | null>(null);
  const [openRaffleCreator, setOpenRaffleCreator] = useState<string | null>(null);

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

  const anyOverlayOpen = !!openRaffleId || createOpen || safetyOpen || dashboardOpen;

  function openRaffle(id: string) {
    const lower = id.toLowerCase();
    window.location.hash = `raffle=${encodeURIComponent(lower)}`;
    setOpenRaffleId(lower);
  }

  function closeRaffle() {
    setOpenRaffleId(null);
    setOpenRaffleCreator(null);
    setSafetyOpen(false);
    window.location.hash = "";
  }

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

      {/* Give space under fixed navbar (no banner anymore) */}
      <div className="pt-24" />

      {/* MAIN (blur/scale when overlays open) */}
      <div
        className={`transition-all duration-300 ${
          anyOverlayOpen ? "scale-[0.98] blur-[2px] opacity-50 pointer-events-none" : ""
        }`}
      >
        <HomePage onOpenRaffle={openRaffle} />
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
              openRaffle(id);
            }}
          />
        </PageModal>
      )}

      {/* Raffle details modal */}
      <RaffleDetailsModal
        raffleId={openRaffleId}
        onClose={closeRaffle}
        onOpenSafety={() => setSafetyOpen(true)}
        onLoadedRaffle={(r) => {
          // Let App own creator so SafetyProofModal can link to it
          setOpenRaffleCreator(r?.creator ? String(r.creator) : null);
        }}
      />

      {/* Safety & Proof modal */}
      <SafetyProofModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        raffleId={openRaffleId ?? ""}
        creator={openRaffleCreator ?? undefined}
      />

      {/* Cashier modal (polished) */}
      <CashierModal isOpen={cashierOpen} onClose={() => setCashierOpen(false)} />

      {/* Create raffle modal */}
      <CreateRaffleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => {}} />
    </div>
  );
}