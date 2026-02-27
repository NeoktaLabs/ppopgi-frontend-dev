// src/App.tsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

function isValidPage(p: any): p is Page {
  return p === "home" || p === "explore" || p === "dashboard" || p === "about" || p === "faq";
}

function getPageFromUrl(): Page {
  try {
    const u = new URL(window.location.href);
    const p = (u.searchParams.get("page") || "").toLowerCase();
    return isValidPage(p) ? p : "home";
  } catch {
    return "home";
  }
}

function setPageInUrl(next: Page) {
  const u = new URL(window.location.href);

  if (!next || next === "home") u.searchParams.delete("page");
  else u.searchParams.set("page", next);

  // ✅ preserve everything else (including ?lottery=...)
  window.history.pushState({}, "", u.toString());
}

export default function App() {
  // 1) Thirdweb
  useAutoConnect({
    client: thirdwebClient,
    chain: ETHERLINK_CHAIN,
    wallets: [createWallet("io.metamask")],
  });

  // 2) Global session
  const activeAccount = useActiveAccount();
  const account = activeAccount?.address ?? null;
  const setSession = useSession((s) => s.set);
  const { disconnect } = useDisconnect();
  const activeWallet = useActiveWallet();

  // 3) Routing (page + lottery deep-link)
  const [page, setPage] = useState<Page>(() => (typeof window !== "undefined" ? getPageFromUrl() : "home"));
  const { selectedLotteryId, openLottery, closeLottery } = useAppRouting(); // keep name for URL param compatibility

  // ✅ store (same items used by cards)
  const store = useLotteryStore("app-modal", 20_000);

  const selectedFromStore = useMemo(() => {
    const id = (selectedLotteryId || "").toLowerCase();
    if (!id) return null;
    return (store.items || []).find((r: any) => String(r.id || "").toLowerCase() === id) ?? null;
  }, [store.items, selectedLotteryId]);

  // 4) Modal states
  const [signInOpen, setSignInOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);

  // 5) Disclaimer gate
  const [showGate, setShowGate] = useState(false);
  const [hasAcceptedGate, setHasAcceptedGate] = useState(false);

  // if user triggers a gated action without acceptance, we store it and run it after accept
  const pendingAfterGateRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    const hasAccepted = localStorage.getItem("ppopgi_terms_accepted") === "true";
    setHasAcceptedGate(hasAccepted);

    // ✅ show gate automatically on non-info pages only
    const isInfoPage = page === "faq" || page === "about";
    if (!hasAccepted && !isInfoPage) setShowGate(true);
    else setShowGate(false);
  }, [page]);

  const ensureGateAccepted = useCallback(
    (action: () => void) => {
      const accepted = localStorage.getItem("ppopgi_terms_accepted") === "true";
      if (accepted) {
        action();
        return;
      }
      pendingAfterGateRef.current = action;
      setShowGate(true);
    },
    [setShowGate]
  );

  const handleAcceptGate = () => {
    localStorage.setItem("ppopgi_terms_accepted", "true");
    setHasAcceptedGate(true);
    setShowGate(false);

    const pending = pendingAfterGateRef.current;
    pendingAfterGateRef.current = null;
    try {
      pending?.();
    } catch {
      // no-op
    }
  };

  // 6) Clock
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Actions
  const handleSignOut = () => {
    if (activeWallet) disconnect(activeWallet);
  };

  // Safety modal
  const [safetyId, setSafetyId] = useState<string | null>(null);

  const handleOpenSafety = (id: string) => {
    closeLottery();
    setSafetyId(id);
  };

  // ✅ Lottery details for safety modal
  const { data: safetyData } = useLotteryDetails(safetyId, !!safetyId);

  // ✅ NEW: single flag to hide layout chrome when any modal/gate is open
  const anyModalOpen = showGate || signInOpen || createOpen || cashierOpen || !!selectedLotteryId || !!safetyId;

  // ✅ OPTIONAL: prevent background scroll while a modal is open
  useEffect(() => {
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [anyModalOpen]);

  /**
   * ✅ Navigate helper:
   * - updates React state
   * - updates URL (?page=...)
   * - gates dashboard behind wallet
   */
  const navigateTo = useCallback(
    (next: Page) => {
      // gate dashboard behind wallet
      if (next === "dashboard" && !account) {
        setPage("home");
        setPageInUrl("home");
        // ✅ require gate before sign-in (connect wallet)
        ensureGateAccepted(() => setSignInOpen(true));
        return;
      }

      setPage(next);
      setPageInUrl(next);
    },
    [account, ensureGateAccepted]
  );

  /**
   * ✅ Sync page from URL on:
   * - first load
   * - browser back/forward
   */
  const didInitRef = useRef(false);
  useEffect(() => {
    const applyFromUrl = () => {
      const next = getPageFromUrl();

      // gate dashboard behind wallet if needed
      if (next === "dashboard" && !account) {
        setPage("home");
        setPageInUrl("home");
        // ✅ require gate before sign-in (connect wallet)
        ensureGateAccepted(() => setSignInOpen(true));
        return;
      }

      setPage(next);
    };

    // initial sync
    if (!didInitRef.current) {
      didInitRef.current = true;
      applyFromUrl();
    }

    // popstate (back/forward)
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, [account, ensureGateAccepted]);

  // 8) Session sync
  useEffect(() => {
    setSession({ account, connector: account ? "thirdweb" : null });

    // if user disconnects while on dashboard, bounce home + keep URL correct
    if (page === "dashboard" && !account) {
      setPage("home");
      setPageInUrl("home");
    }
  }, [account, page, setSession]);

  // 9) Global events (Home banner + external navigation)
  useEffect(() => {
    const onOpenCashier = () => {
      // ✅ cashier is a gated action
      ensureGateAccepted(() => {
        if (account) setCashierOpen(true);
        else setSignInOpen(true);
      });
    };

    const onNavigate = (e: Event) => {
      const ce = e as CustomEvent<{ page?: Page }>;
      const next = ce?.detail?.page;
      if (!next || !isValidPage(next)) return;
      navigateTo(next);
    };

    window.addEventListener("ppopgi:open-cashier", onOpenCashier);
    window.addEventListener("ppopgi:navigate", onNavigate as EventListener);

    return () => {
      window.removeEventListener("ppopgi:open-cashier", onOpenCashier);
      window.removeEventListener("ppopgi:navigate", onNavigate as EventListener);
    };
  }, [account, navigateTo, ensureGateAccepted]);

  // ✅ Gate wrapper for opening a lottery (details modal)
  const gatedOpenLottery = useCallback(
    (id: string) => {
      ensureGateAccepted(() => openLottery(id));
    },
    [ensureGateAccepted, openLottery]
  );

  // ✅ Gate wrapper for safety modal too (optional but consistent)
  const gatedOpenSafety = useCallback(
    (id: string) => {
      ensureGateAccepted(() => handleOpenSafety(id));
    },
    [ensureGateAccepted]
  );

  return (
    <>
      <GlobalDataRefresher intervalMs={5000} />

      <DisclaimerGate open={showGate} onAccept={handleAcceptGate} />

      <MainLayout
        page={page}
        onNavigate={navigateTo}
        account={account}
        // ✅ SIGN-IN is now gated: no wallet connect until disclaimer accepted
        onOpenSignIn={() =>
          ensureGateAccepted(() => {
            setSignInOpen(true);
          })
        }
        onOpenCreate={() =>
          ensureGateAccepted(() => {
            if (account) setCreateOpen(true);
            else setSignInOpen(true);
          })
        }
        onOpenCashier={() =>
          ensureGateAccepted(() => {
            if (account) setCashierOpen(true);
            else setSignInOpen(true);
          })
        }
        onSignOut={handleSignOut}
        hideChrome={anyModalOpen}
      >
        {page === "home" && <HomePage nowMs={nowMs} onOpenLottery={gatedOpenLottery} onOpenSafety={gatedOpenSafety} />}

        {page === "explore" && <ExplorePage onOpenLottery={gatedOpenLottery} onOpenSafety={gatedOpenSafety} />}

        {page === "dashboard" && (
          <DashboardPage account={account} onOpenLottery={gatedOpenLottery} onOpenSafety={gatedOpenSafety} />
        )}

        {page === "about" && <AboutPage />}
        {page === "faq" && <FaqPage />}

        {/* --- Modals --- */}
        <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

        <CreateLotteryModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => {}} />

        <CashierModal open={cashierOpen} onClose={() => setCashierOpen(false)} />

        <LotteryDetailsModal
          open={!!selectedLotteryId}
          lotteryId={selectedLotteryId}
          onClose={closeLottery}
          initialLottery={selectedFromStore as any}
        />

        {safetyId && safetyData && (
          <SafetyProofModal open={!!safetyId} onClose={() => setSafetyId(null)} lottery={safetyData as any} />
        )}
      </MainLayout>
    </>
  );
}