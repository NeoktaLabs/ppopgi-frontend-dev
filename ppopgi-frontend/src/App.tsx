import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { etherlink } from "viem/chains";

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

  // ✅ Safety modal exists, but can ONLY be opened from a raffle context
  const [safetyOpen, setSafetyOpen] = useState(false);

  // Selected raffle (details modal)
  const [openRaffleId, setOpenRaffleId] = useState<string | null>(null);

  // Creator cache for safety modal (optional)
  const [openRaffleCreator, setOpenRaffleCreator] = useState<string | null>(null);

  // Used to force a re-render after disclaimer acceptance (simple + reliable)
  const [disclaimerTick, setDisclaimerTick] = useState(0);

  // Subscribe to wallet state so the UI reacts immediately after connect
  const acc = useAccount();

  // Track which raffle we already applied creator for (prevents needless setState loops)
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
    setSafetyOpen(false);
    window.location.hash = "";
    loadedRaffleIdRef.current = null;
  }

  function openSafetyForRaffle(id: string) {
    openRaffle(id);
    setSafetyOpen(true);
  }

  // ✅ AUTO-SWITCH TO ETHERLINK AFTER CONNECT (kept)
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    if (!acc.isConnected) return;
    if (chainId === etherlink.id) return;

    switchChainAsync({ chainId: etherlink.id }).catch(() => {
      // user rejected or wallet can't switch automatically
    });
  }, [acc.isConnected, chainId, switchChainAsync]);

  return (
    <div className="min-h-screen pb-12 relative">
      <DisclaimerGate onAccept={() => setDisclaimerTick((x) => x + 1)} />

      <Navbar
        onOpenCashier={() => setCashierOpen(true)}
        onOpenCreate={() => setCreateOpen(true)}
        onOpenDashboard={() => setDashboardOpen(true)}
        onGoHome={() => {
          window.location.hash = "";
          setOpenRaffleId(null);
          setSafetyOpen(false);
        }}
        onGoExplore={() => {
          window.location.hash = "explore";
          setOpenRaffleId(null);
          setSafetyOpen(false);
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
            openSafetyForRaffle(raffleId);
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
        onOpenSafety={() => {
          if (openRaffleId) setSafetyOpen(true);
        }}
        onLoadedRaffle={(r) => {
          if (!openRaffleId) return;
          if (loadedRaffleIdRef.current === openRaffleId) return;

          loadedRaffleIdRef.current = openRaffleId;
          setOpenRaffleCreator(r?.creator ? String(r.creator) : null);
        }}
      />

      {/* ✅ Safety modal only opens when a raffle is selected */}
      <SafetyProofModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        raffleId={openRaffleId ?? ""}
        creator={openRaffleCreator ?? undefined}
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