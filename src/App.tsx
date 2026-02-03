// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "./state/useSession";
import { SignInModal } from "./components/SignInModal";
import { DisclaimerGate } from "./components/DisclaimerGate";
import { CreateRaffleModal } from "./components/CreateRaffleModal";
import { RaffleDetailsModal } from "./components/RaffleDetailsModal";
import { RaffleCard } from "./components/RaffleCard";
import { CashierModal } from "./components/CashierModal";
import { acceptDisclaimer, hasAcceptedDisclaimer } from "./state/disclaimer";
import { useHomeRaffles } from "./hooks/useHomeRaffles";
import { ExplorePage } from "./pages/ExplorePage";
import { DashboardPage } from "./pages/DashboardPage";
import { useActiveAccount, useActiveWallet, useDisconnect, useAutoConnect } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";

import { thirdwebClient } from "./thirdweb/client";
import { ETHERLINK_CHAIN } from "./thirdweb/etherlink";

import { SafetyProofModal } from "./components/SafetyProofModal";
import { useRaffleDetails } from "./hooks/useRaffleDetails";

import { TopNav } from "./components/TopNav";

import bg1 from "./assets/backgrounds/bg1.webp";
import bg2 from "./assets/backgrounds/bg2.webp";
import bg3 from "./assets/backgrounds/bg3.webp";

import "./pages/homeTickets.css";

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

  // ✅ Use a fixed background layer instead of backgroundAttachment: fixed (reduces desktop flicker)
  const pageWrap: React.CSSProperties = {
    minHeight: "100vh",
    position: "relative",
    overflowX: "hidden",
  };

  const bgLayer: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    backgroundImage: `url(${chosenBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    transform: "translateZ(0)",
    willChange: "transform",
  };

  const overlay: React.CSSProperties = {
    position: "relative",
    zIndex: 1,
    minHeight: "100vh",
    background:
      "radial-gradient(900px 520px at 15% 10%, rgba(246,182,200,0.14), transparent 60%)," +
      "radial-gradient(900px 520px at 85% 5%, rgba(169,212,255,0.12), transparent 60%)," +
      "rgba(255,255,255,0.02)",
  };

  const container: React.CSSProperties = {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "18px 16px",
  };

  const sectionCard: React.CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))," +
      "radial-gradient(900px 240px at 10% 0%, rgba(255,141,187,0.10), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 240px at 90% 0%, rgba(203,183,246,0.10), rgba(203,183,246,0) 55%)",
    // 🔧 blur reduced a bit to be easier on desktop compositing
    backdropFilter: "blur(2px)",
    border: "2px solid rgba(255,255,255,0.55)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
  };

  const sectionInnerStroke: React.CSSProperties = {
    position: "absolute",
    inset: 6,
    borderRadius: 20,
    pointerEvents: "none",
    border: "1px solid rgba(242,166,198,0.55)",
  };

  const sectionAccent: React.CSSProperties = {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 12,
    width: 6,
    borderRadius: 999,
    background: "linear-gradient(180deg, #FF8DBB, #CBB7F6, #FFD89A)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  };

  const sectionTitleRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    paddingLeft: 18,
  };

  const sectionTitlePill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 1000 as any,
    fontSize: 16,
    letterSpacing: 0.25,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: "#4A0F2B",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const sectionTitleNotch: React.CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "linear-gradient(135deg, rgba(255,141,187,0.95), rgba(203,183,246,0.95))",
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
  };

  const row5: React.CSSProperties = {
    marginTop: 12,
    paddingLeft: 18,
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 8,
    scrollSnapType: "x mandatory",
  };

  const row5Item: React.CSSProperties = {
    scrollSnapAlign: "start",
    flex: "0 0 auto",
  };

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
    <div style={pageWrap}>
      <div style={bgLayer} />
      <div style={overlay}>
        <div style={container}>
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
              <div style={sectionCard}>
                <div style={sectionInnerStroke} />
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
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

              <div style={sectionCard}>
                <div style={sectionInnerStroke} />
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
                    ⏳ Ending soon
                  </div>
                </div>

                <div style={row5}>
                  {endingSoonSorted.map((r) => (
                    <div key={r.id} style={row5Item}>
                      <RaffleCard raffle={r} onOpen={openRaffle} onOpenSafety={openSafety} nowMs={nowMs} />
                    </div>
                  ))}
                  {endingSoonSorted.length === 0 && <div style={{ opacity: 0.9, paddingLeft: 18 }}>Nothing is ending soon.</div>}
                </div>
              </div>

              <div style={sectionCard}>
                <div style={sectionInnerStroke} />
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
                    🧾 Latest terminated raffles
                  </div>
                </div>

                <div style={row5}>
                  {latestTerminated.map((r) => (
                    <div key={r.id} style={row5Item}>
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