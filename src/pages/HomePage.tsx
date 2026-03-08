import { useEffect, useMemo, useState } from "react";
import { useHomeLotteries } from "../hooks/useHomeLotteries";
import { useFinalizerStatus } from "../hooks/useFinalizerStatus";
import { useGlobalStatsBillboard } from "../hooks/useGlobalStatsBillboard";
import { LotteryCard } from "../components/LotteryCard";
import { LotteryCardSkeleton } from "../components/LotteryCardSkeleton";
import { ActivityBoard } from "../components/ActivityBoard";
import "./HomePage.css";

function fmtInt(n: bigint | number | string) {
  try {
    if (typeof n === "bigint") return n.toLocaleString("en-US");
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString("en-US");
  } catch {
    return "0";
  }
}

function fmtUSDC(v: bigint | number | string, opts?: { decimals?: number; maxFrac?: number }) {
  const decimals = opts?.decimals ?? 6;
  const maxFrac = opts?.maxFrac ?? 0;

  try {
    const x =
      typeof v === "bigint"
        ? v
        : BigInt(typeof v === "number" ? Math.trunc(v) : String(v || "0").trim() || "0");

    const sign = x < 0n ? "-" : "";
    const a = x < 0n ? -x : x;

    const base = 10n ** BigInt(decimals);
    const whole = a / base;
    const frac = a % base;

    const wholeStr = whole.toLocaleString("en-US");
    if (maxFrac <= 0) return `${sign}$${wholeStr}`;

    const fracStrFull = frac.toString().padStart(decimals, "0");
    const fracStr = fracStrFull.slice(0, maxFrac).replace(/0+$/, "");
    return fracStr ? `${sign}$${wholeStr}.${fracStr}` : `${sign}$${wholeStr}`;
  } catch {
    return "$0";
  }
}

function fmtCountdown(totalSec: number | null | undefined) {
  if (totalSec == null) return "—";

  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(r)}s`;
  return `${r}s`;
}

type Props = {
  onOpenLottery: (id: string) => void;
  onOpenSafety: (id: string) => void;
};

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function navigateFromHome(page: "explore" | "faq") {
  try {
    window.dispatchEvent(new CustomEvent("ppopgi:navigate", { detail: { page } }));
  } catch {}
}

function HeroSpiritTypewriter() {
  const line1 = "where players risk small for a chance to win bigger";
  const line2 = "and creators build their prize pools from ticket sales";

  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (phase === 1) {
      if (text1.length < line1.length) {
        const t = setTimeout(() => setText1(line1.slice(0, text1.length + 1)), 28);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase(2), 350);
      return () => clearTimeout(t);
    }

    if (phase === 2) {
      if (text2.length < line2.length) {
        const t = setTimeout(() => setText2(line2.slice(0, text2.length + 1)), 28);
        return () => clearTimeout(t);
      }
      setPhase(3);
    }
  }, [phase, text1, text2]);

  return (
    <div className="hp-hero-typer">
      <div className="hp-hero-typer-line">
        {text1}
        {phase === 1 && <span className="hp-hero-caret" />}
      </div>
      <div className="hp-hero-typer-line">
        {text2}
        {phase === 2 && <span className="hp-hero-caret" />}
      </div>
    </div>
  );
}

export function HomePage({ onOpenLottery, onOpenSafety }: Props) {
  useEffect(() => {
    document.title = "Ppopgi 뽑기 — Home";
  }, []);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const finalizer = useFinalizerStatus();
  const { bigPrizes, endingSoon, recentlyFinalized, isLoading } = useHomeLotteries();
  const gs = useGlobalStatsBillboard();

  const finalizerForCards = useMemo(
    () => ({
      running: !!finalizer.running,
      secondsToNextRun: finalizer.secondsToNextRun ?? null,
      tsMs: finalizer.tsMs,
    }),
    [finalizer.running, finalizer.secondsToNextRun, finalizer.tsMs]
  );

  const podium = useMemo(() => {
    if (!bigPrizes || bigPrizes.length === 0) {
      return { gold: null, silver: null, bronze: null };
    }

    const sorted = [...bigPrizes].sort((a, b) => {
      try {
        return BigInt(a.winningPot || "0") < BigInt(b.winningPot || "0") ? 1 : -1;
      } catch {
        return 0;
      }
    });

    return {
      gold: sorted[0] || null,
      silver: sorted[1] || null,
      bronze: sorted[2] || null,
    };
  }, [bigPrizes]);

  const endingSoonSorted = useMemo(() => {
    if (!endingSoon) return [];
    return [...endingSoon].sort((a, b) => num(a.deadline) - num(b.deadline));
  }, [endingSoon]);

  const recentlySettledSorted = useMemo(() => {
    return (recentlyFinalized ?? []).slice(0, 5);
  }, [recentlyFinalized]);

  const stats = useMemo(() => {
    if (!gs.data) return null;
    return {
      tix: fmtInt(gs.data.totalTicketsSold),
      lots: fmtInt(gs.data.totalLotteriesCreated),
      activeUsd: fmtUSDC(gs.data.activeVolumeUSDC),
      settledUsd: fmtUSDC(gs.data.totalPrizesSettledUSDC),
    };
  }, [gs.data]);

  const finalizerTone = useMemo(() => {
    if (finalizer.error) return "warn";
    if (finalizer.running) return "live";
    if (finalizer.secondsToNextRun === 0) return "soon";
    return "idle";
  }, [finalizer.error, finalizer.running, finalizer.secondsToNextRun]);

  const finalizerStat = useMemo(() => {
    if (finalizer.error) {
      return {
        value: "Unavailable",
        kicker: "Draw monitor",
        label: "We’re having trouble checking the next draw.",
      };
    }

    if (finalizer.running) {
      return {
        value: "Drawing winners now! 🎰",
        kicker: "Live draw in progress",
        label: "Lucky tickets are being picked on-chain right now.",
      };
    }

    if (finalizer.secondsToNextRun == null) {
      return {
        value: "—",
        kicker: "Draw monitor",
        label: "Awaiting next draw schedule.",
      };
    }

    if (finalizer.secondsToNextRun === 0) {
      return {
        value: "Any moment now ✨",
        kicker: "Draw almost ready",
        label: "One or more eligible lotteries are about to be processed.",
      };
    }

    return {
      value: fmtCountdown(finalizer.secondsToNextRun),
      kicker: "Next Ppopgi draw",
      label: (
        <span className="hp-cd-label-inner">
          <span className="hp-tooltip-wrap" tabIndex={0}>
            <span className="hp-tooltip-text">Eligible lotteries</span>
            <span className="hp-info-icon">i</span>
            <span className="hp-tooltip">
              Eligible lotteries include the ones with deadline reached or max tickets sold.
            </span>
          </span>
          <span>will be drawn in:</span>
        </span>
      ),
    };
  }, [finalizer.error, finalizer.running, finalizer.secondsToNextRun]);

  return (
    <>
      <div className="hp-hero-card hp-billboard">
        <div className="hp-billboard-bg" />
        <div className="hp-billboard-sparkles" />

        <div className="hp-hero-content">
          <div className="hp-badge-shimmer">
            <div className="hp-hero-badge">✨ The Fair On-Chain Lottery</div>
          </div>

          <div className="hp-hero-title">
            Welcome to <span className="hp-text-gradient">Ppopgi (뽑기)</span>
          </div>

          <div className="hp-hero-sub hp-hero-sub-typer">
            <HeroSpiritTypewriter />
          </div>

          <div className="hp-hero-actions">
            <button className="hp-btn-primary" onClick={() => navigateFromHome("explore")}>
              Explore Lotteries
            </button>
            <button className="hp-btn-secondary" onClick={() => navigateFromHome("faq")}>
              Learn More
            </button>
          </div>
        </div>

        {stats && (
          <div className="hp-stats-dock">
            <div className="hp-stats-title-wrap">
              <div className="hp-stats-title">Live Ppopgi (뽑기) Stats</div>
            </div>

            <div className="hp-stats-row">
              <div className="hp-stat-item highlight">
                <div className="hp-stat-val">{stats.tix}</div>
                <div className="hp-stat-lbl">Tickets Sold</div>
              </div>

              <div className="hp-stat-sep" />

              <div className="hp-stat-item">
                <div className="hp-stat-val">{stats.lots}</div>
                <div className="hp-stat-lbl">Lotteries Created</div>
              </div>

              <div className="hp-stat-sep" />

              <div className="hp-stat-item">
                <div className="hp-stat-val">{stats.activeUsd}</div>
                <div className="hp-stat-lbl">Active Volume</div>
              </div>

              <div className="hp-stat-sep" />

              <div className="hp-stat-item">
                <div className="hp-stat-val">{stats.settledUsd}</div>
                <div className="hp-stat-lbl">Prizes Settled</div>
              </div>
            </div>
          </div>
        )}

        <div className="hp-stats-countdown-wrap">
          <div className={`hp-cd-card is-${finalizerTone}`}>
            <div className="hp-cd-top">
              <div className="hp-cd-badge">
                <span className="hp-cd-badge-dot" />
                {finalizerStat.kicker}
              </div>
            </div>

            <div className="hp-cd-main">
              <div className="hp-cd-icon-wrap">{finalizer.running ? "🎰" : "⏳"}</div>

              <div className="hp-cd-copy">
                <div className="hp-cd-label">{finalizerStat.label}</div>

                <div
                  className={[
                    "hp-cd-display",
                    finalizer.running ? "is-running" : "",
                    finalizer.error ? "is-error" : "",
                  ].join(" ")}
                >
                  <span className="hp-cd-value">{finalizerStat.value}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hp-hero-attach">
        <div className="hp-hero-attach-card">
          <ActivityBoard />
        </div>
      </div>

      <div className="hp-container">
        <div className="hp-podium-section">
          <div className="hp-section-header" style={{ justifyContent: "center", marginBottom: 50 }}>
            <div className="hp-section-title">🏆 Top Active Prizepools</div>
          </div>

          <div className="hp-podium">
            {isLoading && (
              <>
                <LotteryCardSkeleton />
                <LotteryCardSkeleton />
                <LotteryCardSkeleton />
              </>
            )}

            {!isLoading &&
              podium.gold && (
                <LotteryCard
                  lottery={podium.gold}
                  ribbon="gold"
                  nowMs={nowMs}
                  finalizer={finalizerForCards}
                  onOpen={onOpenLottery}
                  onOpenSafety={onOpenSafety}
                />
              )}
          </div>
        </div>

        <div>
          <div className="hp-section-header">
            <div className="hp-section-title">⏳ Ending Soon</div>
            <div className="hp-section-line" />
          </div>

          <div className="hp-strip">
            {endingSoonSorted.map((r) => (
              <div key={r.id} className="hp-strip-item">
                <LotteryCard
                  lottery={r}
                  onOpen={onOpenLottery}
                  onOpenSafety={onOpenSafety}
                  nowMs={nowMs}
                  finalizer={finalizerForCards}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="hp-section-header">
            <div className="hp-section-title">✅ Recently Finalized</div>
            <div className="hp-section-line" />
          </div>

          <div className="hp-strip">
            {recentlySettledSorted.map((r) => (
              <div key={r.id} className="hp-strip-item">
                <LotteryCard
                  lottery={r}
                  onOpen={onOpenLottery}
                  onOpenSafety={onOpenSafety}
                  nowMs={nowMs}
                  finalizer={finalizerForCards}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}