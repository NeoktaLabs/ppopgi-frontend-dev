// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { useAutoConnect, useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { thirdwebClient } from "./thirdweb/client";
import { ETHERLINK_CHAIN } from "./thirdweb/etherlink";

// --- Layouts & Pages ---
import { MainLayout } from "./layouts/MainLayout";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { DashboardPage } from "./pages/DashboardPage";
import { AboutPage } from "./pages/AboutPage";
import { FaqPage } from "./pages/FaqPage";

// --- Components (Modals) ---
import { SignInModal } from "./components/SignInModal";
import { CreateLotteryModal } from "./components/CreateLotteryModal";
import { LotteryDetailsModal } from "./components/LotteryDetailsModal";
import { CashierModal } from "./components/CashierModal";
import { SafetyProofModal } from "./components/SafetyProofModal";
import { DisclaimerGate } from "./components/DisclaimerGate";

// ✅ global sync refresher
import { GlobalDataRefresher } from "./components/GlobalDataRefresher";

// --- Hooks / State ---
import { useSession } from "./state/useSession";
import { useAppRouting } from "./hooks/useAppRouting";
import { useLotteryDetails } from "./hooks/useLotteryDetails";
import { useLotteryStore } from "./hooks/useLotteryStore";

type Page = "home" | "explore" | "dashboard" | "about" | "faq";

export default function App() {
  // 1) Thirdweb
  useAutoConnect({ client: thirdwebClient, chain: ETHERLINK_CHAIN, wallets: [createWallet("io.metamask")] });

  // 2) Global session
  const activeAccount = useActiveAccount();
  const account = activeAccount?.address ?? null;
  const setSession = useSession((s) => s.set);
  const { disconnect } = useDisconnect();
  const activeWallet = useActiveWallet();

  // 3) Routing
  const [page, setPage] = useState<Page>("home");
  const { selectedRaffleId, openRaffle, closeRaffle } = useAppRouting(); // keep name for URL param compatibility

  // ✅ store (same items used by cards)
  const store = useLotteryStore("app-modal", 20_000);

  const selectedFromStore = useMemo(() => {
    const id = (selectedRaffleId || "").toLowerCase();
    if (!id) return null;
    return (store.items || []).find((r: any) => String(r.id || "").toLowerCase() === id) ?? null;
  }, [store.items, selectedRaffleId]);

  // 4) Modal states
  const [signInOpen, setSignInOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);

  // 5) Global events (Home banner)
  useEffect(() => {
    const onOpenCashier = () => {
      if (account) setCashierOpen(true);
      else setSignInOpen(true);
    };

    const onNavigate = (e: Event) => {
      const ce = e as CustomEvent<{ page?: Page }>;
      const next = ce?.detail?.page;
      if (!next) return;

      // gate dashboard behind wallet
      if (next === "dashboard" && !account) {
        setPage("home");
        setSignInOpen(true);
        return;
      }
      setPage(next);
    };

    window.addEventListener("ppopgi:open-cashier", onOpenCashier);
    window.addEventListener("ppopgi:navigate", onNavigate as EventListener);

    return () => {
      window.removeEventListener("ppopgi:open-cashier", onOpenCashier);
      window.removeEventListener("ppopgi:navigate", onNavigate as EventListener);
    };
  }, [account]);

  // 6) Disclaimer gate
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    const hasAccepted = localStorage.getItem("ppopgi_terms_accepted");
    if (!hasAccepted) setShowGate(true);
  }, []);

  const handleAcceptGate = () => {
    localStorage.setItem("ppopgi_terms_accepted", "true");
    setShowGate(false);
  };

  // 7) Clock
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 8) Session sync
  useEffect(() => {
    setSession({ account, connector: account ? "thirdweb" : null });
    if (page === "dashboard" && !account) setPage("home");
  }, [account, page, setSession]);

  // Actions
  const handleSignOut = () => {
    if (activeWallet) disconnect(activeWallet);
  };

  // Safety modal
  const [safetyId, setSafetyId] = useState<string | null>(null);

  const handleOpenSafety = (id: string) => {
    closeRaffle();
    setSafetyId(id);
  };

  // ✅ Lottery details for safety modal
  const { data: safetyData } = useLotteryDetails(safetyId, !!safetyId);

  return (
    <>
      <GlobalDataRefresher intervalMs={5000} />

      <DisclaimerGate open={showGate} onAccept={handleAcceptGate} />

      <MainLayout
        page={page}
        onNavigate={setPage}
        account={account}
        onOpenSignIn={() => setSignInOpen(true)}
        onOpenCreate={() => (account ? setCreateOpen(true) : setSignInOpen(true))}
        onOpenCashier={() => (account ? setCashierOpen(true) : setSignInOpen(true))}
        onSignOut={handleSignOut}
      >
        {page === "home" && <HomePage nowMs={nowMs} onOpenRaffle={openRaffle} onOpenSafety={handleOpenSafety} />}

        {page === "explore" && <ExplorePage onOpenRaffle={openRaffle} onOpenSafety={handleOpenSafety} />}

        {page === "dashboard" && (
          <DashboardPage account={account} onOpenRaffle={openRaffle} onOpenSafety={handleOpenSafety} />
        )}

        {page === "about" && <AboutPage />}
        {page === "faq" && <FaqPage />}

        {/* --- Modals --- */}
        <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

        <CreateLotteryModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => {}} />

        <CashierModal open={cashierOpen} onClose={() => setCashierOpen(false)} />

        <LotteryDetailsModal
          open={!!selectedRaffleId}
          raffleId={selectedRaffleId} // keep prop name if your modal still expects raffleId
          onClose={closeRaffle}
          initialRaffle={selectedFromStore as any}
        />

        {safetyId && safetyData && (
          <SafetyProofModal open={!!safetyId} onClose={() => setSafetyId(null)} raffle={safetyData as any} />
        )}
      </MainLayout>
    </>
  );
}