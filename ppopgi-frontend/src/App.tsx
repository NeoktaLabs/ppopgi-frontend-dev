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

  // ✅ Safety modal is controlled from App (so Navbar button can open it)
  const [safetyOpen, setSafetyOpen] = useState(false);

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

  const anyOverlayOpen = !!openRaffleId || createOpen || dashboardOpen || safetyOpen;

  function openRaffle(id: string) {
    const lower = id.toLowerCase();
    window.location.hash = `raffle=${encodeURIComponent(lower)}`;
    setOpenRaffleId(lower);
    loadedRaffleIdRef.current = null;
  }

  function closeRaffle() {
    setOpenRaffleId(null);
    setSafetyOpen(false);
    window.location.hash = "";
    loadedRaffleIdRef.current = null;
  }

  function openSafetyGlobal() {
    // If a raffle is selected, safety is meaningful right away.
    // If not, your SafetyProofModal should show a “select a raffle” / empty state.
    setSafetyOpen(true);
  }

  return (
    <div className="min-h-screen pb-12 relative">
      <DisclaimerGate onAccept={() => setDisclaimerTick((x) => x + 1)} />

      <Navbar
        onOpenCashier={() => setCashierOpen(true)}
        onOpenCreate={() => setCreateOpen(true)}
        onOpenDashboard={() => setDashboardOpen(true)}
        onOpenSafety={openSafetyGlobal} // ✅ FIX: Safety button works
        onGoHome={() => {
          // ✅ Logo goes home
          window.location.hash = "";
          setSafetyOpen(false);
          setOpenRaffleId(null);
        }}
        onGoExplore={() => {
          // ✅ For now: hash route placeholder; later we’ll scroll or navigate
          window.location.hash = "explore";
          setSafetyOpen(false);
          setOpenRaffleId(null);
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
            // ✅ Home safety opens raffle + safety modal
            openRaffle(raffleId);
            setSafetyOpen(true);
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
        // ✅ FIX: details "Safety & Proof" button opens modal
        onOpenSafety={() => setSafetyOpen(true)}
        onLoadedRaffle={(r) => {
          // Optional: keep this only if something else needs it later
          if (!openRaffleId) return;
          if (loadedRaffleIdRef.current === openRaffleId) return;
          loadedRaffleIdRef.current = openRaffleId;

          void r;
        }}
      />

      {/* ✅ Safety modal lives outside; RaffleDetailsModal should render it based on safetyOpen
          If your SafetyProofModal is already in RaffleDetailsModal, we’ll move it next.
          For now, keep safetyOpen plumbing; next step we’ll wire your actual SafetyProofModal here. */}
      {/* TODO: mount your SafetyProofModal here if it’s an App-level component */}

      <CashierModal isOpen={cashierOpen} onClose={() => setCashierOpen(false)} />

      <CreateRaffleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {}}
      />

      {/* If you currently render SafetyProofModal somewhere else, tell me where,
          and I’ll paste the exact block to mount it here using safetyOpen + openRaffleId. */}
    </div>
  );
}