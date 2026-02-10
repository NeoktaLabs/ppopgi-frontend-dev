// src/App.tsx
import { useEffect, useState } from "react";
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
import { CreateRaffleModal } from "./components/CreateRaffleModal";
import { RaffleDetailsModal } from "./components/RaffleDetailsModal";
import { CashierModal } from "./components/CashierModal";
import { SafetyProofModal } from "./components/SafetyProofModal";
import { DisclaimerGate } from "./components/DisclaimerGate";

// --- Hooks ---
import { useSession } from "./state/useSession";
import { useAppRouting } from "./hooks/useAppRouting";
import { useRaffleDetails } from "./hooks/useRaffleDetails";

type Page = "home" | "explore" | "dashboard" | "about" | "faq";

function pageFromPath(pathname: string): Page {
  const p = (pathname || "/").toLowerCase();
  if (p.startsWith("/explore")) return "explore";
  if (p.startsWith("/dashboard")) return "dashboard";
  if (p.startsWith("/about")) return "about";
  if (p.startsWith("/faq")) return "faq";
  return "home";
}

export default function App() {
  // 1. Thirdweb Config
  useAutoConnect({ client: thirdwebClient, chain: ETHERLINK_CHAIN, wallets: [createWallet("io.metamask")] });

  // 2. Global State
  const activeAccount = useActiveAccount();
  const account = activeAccount?.address ?? null;
  const setSession = useSession((s) => s.set);
  const { disconnect } = useDisconnect();
  const activeWallet = useActiveWallet();

  // 3. Routing & Navigation
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const { selectedRaffleId, openRaffle, closeRaffle } = useAppRouting();

  // 4. Modal States
  const [signInOpen, setSignInOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);

  // GATE STATE
  const [showGate, setShowGate] = useState(false);

  // Safety Modal Logic
  const [safetyId, setSafetyId] = useState<string | null>(null);

  // 5. Global Clock (One tick for the whole app)
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // CHECK DISCLAIMER STATUS ON LOAD
  useEffect(() => {
    const hasAccepted = localStorage.getItem("ppopgi_terms_accepted");
    if (!hasAccepted) setShowGate(true);
  }, []);

  const handleAcceptGate = () => {
    localStorage.setItem("ppopgi_terms_accepted", "true");
    setShowGate(false);
  };

  // ✅ Listen for HomePage banner actions (open cashier / navigate)
  useEffect(() => {
    const onOpenCashier = () => {
      if (account) setCashierOpen(true);
      else setSignInOpen(true);
    };

    const onNavigate = (evt: Event) => {
      const e = evt as CustomEvent<{ page?: Page }>;
      const next = e?.detail?.page;
      if (!next) return;

      // dashboard requires account
      if (next === "dashboard" && !account) {
        setSignInOpen(true);
        return;
      }

      setPage(next);

      // Optional: keep URL in sync without a router
      const path =
        next === "home"
          ? "/"
          : next === "explore"
          ? "/explore"
          : next === "dashboard"
          ? "/dashboard"
          : next === "about"
          ? "/about"
          : "/faq";

      try {
        window.history.pushState({}, "", path);
      } catch {}
    };

    // Handle back/forward buttons if URL changes
    const onPopState = () => {
      setPage(pageFromPath(window.location.pathname));
    };

    window.addEventListener("ppopgi:open-cashier", onOpenCashier as any);
    window.addEventListener("ppopgi:navigate", onNavigate as any);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("ppopgi:open-cashier", onOpenCashier as any);
      window.removeEventListener("ppopgi:navigate", onNavigate as any);
      window.removeEventListener("popstate", onPopState);
    };
  }, [account]);

  // Sync Session
  useEffect(() => {
    setSession({ account, connector: account ? "thirdweb" : null });
    if (page === "dashboard" && !account) setPage("home");
  }, [account, page, setSession]);

  // Actions
  const handleSignOut = () => {
    if (activeWallet) disconnect(activeWallet);
  };

  const handleOpenSafety = (id: string) => {
    closeRaffle();
    setSafetyId(id);
  };

  // Data for Safety Modal
  const { data: safetyData } = useRaffleDetails(safetyId, !!safetyId);

  return (
    <>
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
        {/* --- Page Routing --- */}
        {page === "home" && <HomePage nowMs={nowMs} onOpenRaffle={openRaffle} onOpenSafety={handleOpenSafety} />}

        {page === "explore" && <ExplorePage onOpenRaffle={openRaffle} onOpenSafety={handleOpenSafety} />}

        {page === "dashboard" && <DashboardPage account={account} onOpenRaffle={openRaffle} onOpenSafety={handleOpenSafety} />}

        {page === "about" && <AboutPage />}

        {page === "faq" && <FaqPage />}

        {/* --- Global Modals --- */}
        <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

        <CreateRaffleModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            /* Optional toast logic here */
          }}
        />

        <CashierModal open={cashierOpen} onClose={() => setCashierOpen(false)} />

        <RaffleDetailsModal open={!!selectedRaffleId} raffleId={selectedRaffleId} onClose={closeRaffle} />

        {safetyId && safetyData && <SafetyProofModal open={!!safetyId} onClose={() => setSafetyId(null)} raffle={safetyData} />}
      </MainLayout>
    </>
  );
}