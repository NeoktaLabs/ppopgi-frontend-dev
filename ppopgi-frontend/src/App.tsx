// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // ✅ Global safety modal
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyRaffleId, setSafetyRaffleId] = useState<string | null>(null);
  const [safetyCreator, setSafetyCreator] = useState<string | null>(null);

  // Selected raffle (details modal)
  const [openRaffleId, setOpenRaffleId] = useState<string | null>(null);

  // Creator cache (when details loads)
  const [openRaffleCreator, setOpenRaffleCreator] = useState<string | null>(null);

  // Used to force a re-render after disclaimer acceptance (simple + reliable)
  const [disclaimerTick, setDisclaimerTick] = useState(0);

  // Wallet state subscription
  const acc = useAccount();

  // Prevent loops for onLoadedRaffle
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

    // reset creator while loading
    setOpenRaffleCreator(null);
    loadedRaffleIdRef.current = null;
  }

  function closeRaffle() {
    setOpenRaffleId(null);
    setOpenRaffleCreator(null);

    // also close safety and clear selection
    setSafetyOpen(false);
    setSafetyRaffleId(null);
    setSafetyCreator(null);

    window.location.hash = "";
    loadedRaffleIdRef.current = null;
  }

  function openSafetyGlobal() {
    // Opens even if no raffle is selected (modal will show empty/limited state)
    setSafetyRaffleId(openRaffleId ?? null);
    setSafetyCreator(openRaffleCreator ?? null);
    setSafetyOpen(true);
  }

  function openSafetyForRaffle(id: string) {
    const lower = id.toLowerCase();

    // Ensure the app selects this raffle (hash + details modal)
    openRaffle(lower);

    // Safety modal should point to that raffle immediately
    setSafetyRaffleId(lower);
    setSafetyCreator(null); // will be filled when details loads (if available)
    setSafetyOpen(true);
  }

  // Keep safety modal synced if user opens raffle via hash while safety is already open
  useEffect(() => {
    if (!safetyOpen) return;
    if (!openRaffleId) return;
    setSafetyRaffleId(openRaffleId);
  }, [safetyOpen, openRaffleId]);

  return (
    <div className="min-h-screen pb-12 relative">
      <DisclaimerGate onAccept={() => setDisclaimerTick((x) => x + 1)} />

      <Navbar
        onOpenCashier={() => setCashierOpen(true)}
        onOpenCreate={() => setCreateOpen(true)}
        onOpenDashboard={() => setDashboardOpen(true)}
        onOpenSafety={openSafetyGlobal}
        onGoHome={() => {
          window.location.hash = "";
          setOpenRaffleId(null);
          setOpenRaffleCreator(null);

          setSafetyOpen(false);
          setSafetyRaffleId(null);
          setSafetyCreator(null);
        }}
        onGoExplore={() => {
          // Placeholder route (we can implement later)
          window.location.hash = "explore";

          setOpenRaffleId(null);
          setOpenRaffleCreator(null);

          setSafetyOpen(false);
          setSafetyRaffleId(null);
          setSafetyCreator(null);
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
          onOpenSafety={(raffleId) => openSafetyForRaffle(raffleId)}
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
        onOpenSafety={() => {
          if (openRaffleId) openSafetyForRaffle(openRaffleId);
          else setSafetyOpen(true);
        }}
        onLoadedRaffle={(r) => {
          if (!openRaffleId) return;
          if (loadedRaffleIdRef.current === openRaffleId) return;

          loadedRaffleIdRef.current = openRaffleId;

          const creator = r?.creator ? String(r.creator) : null;
          setOpenRaffleCreator(creator);

          // If safety is open for this raffle, also update creator there
          if (safetyOpen && safetyRaffleId?.toLowerCase() === openRaffleId.toLowerCase()) {
            setSafetyCreator(creator);
          }
        }}
      />

      <SafetyProofModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        raffleId={(safetyRaffleId ?? openRaffleId ?? "") as string}
        creator={(safetyCreator ?? openRaffleCreator) ?? undefined}
      />

      <CashierModal isOpen={cashierOpen} onClose={() => setCashierOpen(false)} />

      <CreateRaffleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {}}
      />
    </div>
  );
}