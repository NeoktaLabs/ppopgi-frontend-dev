// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { useSession } from "../features/wallet/hooks/useSession";
import { SignInModal } from "../features/wallet/components/SignInModal/SignInModal";
import { DisclaimerGate } from "../features/compliance/components/DisclaimerGate/DisclaimerGate";
import { CreateRaffleModal } from "../features/raffles/components/CreateRaffleModal/CreateRaffleModal";
import { RaffleDetailsModal } from "../features/raffles/components/RaffleDetailsModal/RaffleDetailsModal";
import { RaffleCard } from "../features/raffles/components/RaffleCard/RaffleCard";
import { CashierModal } from "../features/cashier/components/CashierModal/CashierModal";
import { acceptDisclaimer, hasAcceptedDisclaimer } from "../features/compliance/storage/disclaimer";
import { useHomeRaffles } from "../features/raffles/hooks/useHomeRaffles";
import { ExplorePage } from "../pages/explore/ExplorePage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { useActiveAccount, useActiveWallet, useDisconnect, useAutoConnect } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";

import { thirdwebClient } from "../shared/lib/thirdweb/client";
import { ETHERLINK_CHAIN } from "../shared/lib/thirdweb/etherlink";

import { SafetyProofModal } from "../features/safety/components/SafetyProofModal/SafetyProofModal";
import { useRaffleDetails } from "../features/raffles/hooks/useRaffleDetails";

import { TopNav } from "../shared/ui/TopNav/TopNav";

import bg1 from "../shared/assets/backgrounds/bg1.webp";
import bg2 from "../shared/assets/backgrounds/bg2.webp";
import bg3 from "../shared/assets/backgrounds/bg3.webp";

import "../pages/home/homeTickets.css";
import { createAppStyles } from "./App.styles";

const BACKGROUNDS = [bg1, bg2, bg3];
const pickRandomBg = () => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

type Page = "home" | "explore" | "dashboard";

function extractAddress(input: string): string | null {
  const m = input?.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0] : null;
}

function getRaffleFromQuery(): string | null {
  try {
    const url = new URL(window.location.href);
    return extractAddress(url.searchParams.get("raffle") || "");
  } catch {
    return null;
  }
}

function setRaffleQuery(id: string | null) {
  try {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    if (id) url.searchParams.set("raffle", id);
    window.history.pushState({}, "", url.toString());
  } catch {
    // ignore
  }
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function App() {
  useAutoConnect({
    client: thirdwebClient,
    chain: ETHERLINK_CHAIN,
    wallets: [createWallet("io.metamask")],
  });

  const chosenBg = useMemo(pickRandomBg, []);

  const setSession = useSession((s) => s.set);
  const clearSession = useSession((s) => s.clear);

  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const account = activeAccount?.address ?? null;

  const [page, setPage] = useState<Page>("home");
  const [signInOpen, setSignInOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createdHint, setCreatedHint] = useState<string | null>(null);

  // Details modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);

  // Safety modal
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyRaffleId, setSafetyRaffleId] = useState<string | null>(null);

  const { data: safetyData } = useRaffleDetails(safetyRaffleId, safetyOpen);

  // ✅ ONE global clock tick for the whole app (no per-card timers)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => setGateOpen(!hasAcceptedDisclaimer()), []);
  const onAcceptGate = () => {
    acceptDisclaimer();
    setGateOpen(false);
  };

  useEffect(() => {
    if (!account) setSession({ account: null, connector: null });
    else setSession({ account, connector: "thirdweb" });
  }, [account, setSession]);

  useEffect(() => {
    if (page === "dashboard" && !account) setPage("home");
  }, [page, account]);

  const { items, bigPrizes, endingSoon, note: homeNote, refetch } = useHomeRaffles();

  function onCreatedRaffle() {
    setCreatedHint("Raffle created. It may take a moment to appear.");
    refetch();
    setTimeout(refetch, 3500);
  }

  function openRaffle(id: string) {
    const addr = extractAddress(id) ?? id;
    setSelectedRaffleId(addr);
    setDetailsOpen(true);
    setRaffleQuery(addr);

    setSafetyOpen(false);
    setSafetyRaffleId(null);
  }

  function closeRaffle() {
    setDetailsOpen(false);
    setSelectedRaffleId(null);
    setRaffleQuery(null);
  }

  function openSafety(id: string) {
    const addr = extractAddress(id) ?? id;

    setDetailsOpen(false);
    setSelectedRaffleId(null);
    setRaffleQuery(null);

    setSafetyRaffleId(addr);
    setSafetyOpen(true);
  }

  function closeSafety() {
    setSafetyOpen(false);
    setSafetyRaffleId(null);
  }

  useEffect(() => {
    const fromQuery = getRaffleFromQuery();
    if (fromQuery) {
      setSelectedRaffleId(fromQuery);
      setDetailsOpen(true);
    }
    const onPop = () => {
      const p = getRaffleFromQuery();
      if (p) {
        setSelectedRaffleId(p);
        setDetailsOpen(true);
      } else {
        setDetailsOpen(false);
        setSelectedRaffleId(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function onSignOut() {
    try {
      if (activeWallet) disconnect(activeWallet);
    } catch {
      // ignore
    }
    clearSession();
    setCreatedHint(null);
  }

  function onNavigate(next: Page) {
    if (next === "dashboard" && !account) {
      setSignInOpen(true);
      setPage("home");
      return;
    }
    setPage(next);
  }

  /* ───────────── styles ───────────── */

  const styles = useMemo(() => createAppStyles(chosenBg), [chosenBg]);

  /* ───────────── render helpers ───────────── */

  const podium = useMemo(() => {
    const sorted = [...bigPrizes].sort((a, b) => {
      try {
        const A = BigInt(a.winningPot || "0");
        const B = BigInt(b.winningPot || "0");
        return A === B ? 0 : A < B ? 1 : -1;
      } catch {
        return 0;
      }
    });

    const top3 = sorted.slice(0, 3);
    return {
      gold: top3[0] || null,
      silver: top3[1] || null,
      bronze: top3[2] || null,
    };
  }, [bigPrizes]);

  const endingSoonSorted = useMemo(() => {
    return [...endingSoon].sort((a, b) => num(a.deadline) - num(b.deadline));
  }, [endingSoon]);

  const latestTerminated = useMemo(() => {
    const all = items ?? [];
    const terminated = all.filter((r) => r.status !== "OPEN" && r.status !== "FUNDING_PENDING");

    const sortKey = (r: any) => {
      const finalizedAt = num(r.finalizedAt);
      const completedAt = num(r.completedAt);
      const canceledAt = num(r.canceledAt);
      const updated = num(r.lastUpdatedTimestamp);
      return Math.max(finalizedAt, completedAt, canceledAt, updated);
    };

    return terminated.sort((a: any, b: any) => sortKey(b) - sortKey(a)).slice(0, 5);
  }, [items]);

  return (
    <div style={styles.pageWrap}>
      <div style={styles.bgLayer} />
      <div style={styles.overlay}>
        <div style={styles.container}>
          <DisclaimerGate open={gateOpen} onAccept={onAcceptGate} />

          <TopNav
            page={page}
            account={account}
            onNavigate={onNavigate}
            onOpenExplore={() => {}}
            onOpenDashboard={() => {}}
            onOpenCreate={() => (account ? setCreateOpen(true) : setSignInOpen(true))}
            onOpenCashier={() => setCashierOpen(true)}
            onOpenSignIn={() => setSignInOpen(true)}
            onSignOut={onSignOut}
          />

          {page === "home" && homeNote && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.92 }}>{homeNote}</div>}
          {createdHint && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.95 }}>{createdHint}</div>}

          {page === "home" && (
            <>
              <div style={styles.sectionCard}>
                <div style={styles.sectionInnerStroke} />
                <div style={styles.sectionAccent} />
                <div style={styles.sectionTitleRow}>
                  <div style={styles.sectionTitlePill}>
                    <span style={styles.sectionTitleNotch} />
                    🏆 Big prizes right now
                  </div>
                </div>

                <div className="pp-podium" style={{ justifyContent: "center", paddingLeft: 18, marginTop: 12 }}>
                  <div className="pp-podium__silver">
                    {podium.silver ? (
                      <RaffleCard
                        raffle={podium.silver}
                        onOpen={openRaffle}
                        onOpenSafety={openSafety}
                        ribbon="silver"
                        nowMs={nowMs}
                      />
                    ) : null}
                  </div>

                  <div className="pp-podium__gold">
                    {podium.gold ? (
                      <RaffleCard
                        raffle={podium.gold}
                        onOpen={openRaffle}
                        onOpenSafety={openSafety}
                        ribbon="gold"
                        nowMs={nowMs}
                      />
                    ) : null}
                  </div>

                  <div className="pp-podium__bronze">
                    {podium.bronze ? (
                      <RaffleCard
                        raffle={podium.bronze}
                        onOpen={openRaffle}
                        onOpenSafety={openSafety}
                        ribbon="bronze"
                        nowMs={nowMs}
                      />
                    ) : null}
                  </div>

                  {bigPrizes.length === 0 && <div style={{ opacity: 0.9, paddingLeft: 18 }}>No active raffles right now.</div>}
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionInnerStroke} />
                <div style={styles.sectionAccent} />
                <div style={styles.sectionTitleRow}>
                  <div style={styles.sectionTitlePill}>
                    <span style={styles.sectionTitleNotch} />
                    ⏳ Ending soon
                  </div>
                </div>

                <div style={styles.row5}>
                  {endingSoonSorted.map((r) => (
                    <div key={r.id} style={styles.row5Item}>
                      <RaffleCard raffle={r} onOpen={openRaffle} onOpenSafety={openSafety} nowMs={nowMs} />
                    </div>
                  ))}
                  {endingSoonSorted.length === 0 && <div style={{ opacity: 0.9, paddingLeft: 18 }}>Nothing is ending soon.</div>}
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionInnerStroke} />
                <div style={styles.sectionAccent} />
                <div style={styles.sectionTitleRow}>
                  <div style={styles.sectionTitlePill}>
                    <span style={styles.sectionTitleNotch} />
                    🧾 Latest terminated raffles
                  </div>
                </div>

                <div style={styles.row5}>
                  {latestTerminated.map((r) => (
                    <div key={r.id} style={styles.row5Item}>
                      <RaffleCard raffle={r} onOpen={openRaffle} onOpenSafety={openSafety} nowMs={nowMs} />
                    </div>
                  ))}
                  {latestTerminated.length === 0 && <div style={{ opacity: 0.9, paddingLeft: 18 }}>No terminated raffles to show yet.</div>}
                </div>
              </div>
            </>
          )}

          {page === "explore" && <ExplorePage onOpenRaffle={openRaffle} />}
          {page === "dashboard" && <DashboardPage account={account} onOpenRaffle={openRaffle} />}

          <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
          <CreateRaffleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onCreatedRaffle} />
          <RaffleDetailsModal open={detailsOpen} raffleId={selectedRaffleId} onClose={closeRaffle} />

          {safetyOpen && safetyData ? <SafetyProofModal open={safetyOpen} onClose={closeSafety} raffle={safetyData} /> : null}

          <CashierModal open={cashierOpen} onClose={() => setCashierOpen(false)} />
        </div>
      </div>
    </div>
  );
}
