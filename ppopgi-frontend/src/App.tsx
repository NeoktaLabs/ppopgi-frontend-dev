// src/App.tsx
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
import { ExplorePage } from "./features/explore/ExplorePage";

export default function App() {
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // Safety modal: raffle-only (legacy, separate from RaffleSafetyModal inside details)
  const [safetyOpen, setSafetyOpen] = useState(false);

  const [openRaffleId, setOpenRaffleId] = useState<string | null>(null);
  const [openRaffleCreator, setOpenRaffleCreator] = useState<string | null>(null);

  const [disclaimerTick, setDisclaimerTick] = useState(0);

  const acc = useAccount();
  const loadedRaffleIdRef = useRef<string | null>(null);

  // ✅ Track last “main page” so closing a raffle returns correctly
  const lastMainRouteRef = useRef<"home" | "explore">("home");

  // --- routing via hash ---
  const route = useMemo(() => {
    const h = window.location.hash || "";
    if (h.includes("raffle=")) return "raffle";
    if (h === "#explore" || h.startsWith("#explore") || h === "#explore") return "explore";
    return "home";
  }, [disclaimerTick, acc.address]);

  // keep last main route in sync (but never overwrite it while viewing a raffle)
  useEffect(() => {
    if (route === "home" || route === "explore") {
      lastMainRouteRef.current = route;
    }
  }, [route]);

  // shared link support: /#raffle=0x...
  const raffleFromHash = useMemo(() => {
    const m = window.location.hash.match(/raffle=([^&]+)/);
    return m ? decodeURIComponent(m[1]).toLowerCase() : null;
  }, [disclaimerTick, acc.address]);

  useEffect(() => {
    if (raffleFromHash) setOpenRaffleId(raffleFromHash);
    else setOpenRaffleId(null);
  }, [raffleFromHash]);

  const anyOverlayOpen = !!openRaffleId || createOpen || dashboardOpen || safetyOpen;

  function openRaffle(id: string) {
    // ✅ remember where user came from (home/explore) BEFORE switching hash to raffle
    lastMainRouteRef.current = route === "explore" ? "explore" : "home";

    const lower = id.toLowerCase();
    window.location.hash = `raffle=${encodeURIComponent(lower)}`;
    setOpenRaffleId(lower);

    setOpenRaffleCreator(null);
    loadedRaffleIdRef.current = null;
  }

  function closeRaffle() {
    setOpenRaffleId(null);
    setOpenRaffleCreator(null);
    setSafetyOpen(false);

    // ✅ return to previous main page
    window.location.hash = lastMainRouteRef.current === "explore" ? "explore" : "";
    loadedRaffleIdRef.current = null;
  }

  function openSafetyForRaffle(id: string) {
    openRaffle(id);
    setSafetyOpen(true);
  }

  // ✅ auto-switch to Etherlink after connect (kept)
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    if (!acc.isConnected) return;
    if (chainId === etherlink.id) return;
    switchChainAsync({ chainId: etherlink.id }).catch(() => {});
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
          lastMainRouteRef.current = "home";
        }}
        onGoExplore={() => {
          window.location.hash = "explore";
          setOpenRaffleId(null);
          setSafetyOpen(false);
          lastMainRouteRef.current = "explore";
        }}
      />

      <div className="pt-24" />

      {/* ✅ Main page switches by hash */}
      <div
        className={`transition-all duration-300 ${
          anyOverlayOpen ? "scale-[0.98] blur-[2px] opacity-50 pointer-events-none" : ""
        }`}
      >
        {route === "explore" ? (
          <ExplorePage onOpenRaffle={openRaffle} onOpenSafety={openSafetyForRaffle} />
        ) : (
          <HomePage onOpenRaffle={openRaffle} onOpenSafety={openSafetyForRaffle} />
        )}
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

      {/* Legacy safety modal (raffle-only) */}
      <SafetyProofModal
        open={safetyOpen && !!openRaffleId}
        onClose={() => setSafetyOpen(false)}
        raffleId={openRaffleId ?? ""}
        creator={openRaffleCreator ?? undefined}
      />

      <CashierModal isOpen={cashierOpen} onClose={() => setCashierOpen(false)} />

      <CreateRaffleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => {}} />
    </div>
  );
}