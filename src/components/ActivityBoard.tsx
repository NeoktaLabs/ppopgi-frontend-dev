// src/components/ActivityBoard.tsx
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { formatUnits } from "ethers";
import { fetchGlobalActivity, type GlobalActivityItem } from "../indexer/subgraph";
import { useRevalidate } from "../hooks/useRevalidateTick";
import "./ActivityBoard.css";

type LocalActivityItem = GlobalActivityItem & { pending?: boolean; pendingLabel?: string };

const REFRESH_MS = 5_000;

const shortAddr = (s: string) => (s ? `${s.slice(0, 4)}...${s.slice(-4)}` : "—");

function isHidden() {
  try {
    return typeof document !== "undefined" && document.hidden;
  } catch {
    return false;
  }
}

function parseHttpStatus(err: any): number | null {
  const msg = String(err?.message || err || "");
  const m = msg.match(/SUBGRAPH_HTTP_ERROR_(\d{3})/);
  return m ? Number(m[1]) : null;
}

function isRateLimitError(err: any) {
  const status = parseHttpStatus(err);
  if (status === 429 || status === 503) return true;

  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("too many requests") || msg.includes("rate limit");
}

function isFresh(ts: string, seconds = 10) {
  const now = Math.floor(Date.now() / 1000);
  const t = Number(ts || "0");
  if (!Number.isFinite(t) || t <= 0) return false;
  return now - t <= seconds;
}

function timeAgoFrom(nowSec: number, ts: string) {
  const diff = nowSec - Number(ts);
  if (!Number.isFinite(diff)) return "—";
  if (diff < 0) return "0s";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export function ActivityBoard() {
  const [items, setItems] = useState<LocalActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // used only to render "x ago" values; we tick it when we refresh, not every second
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  // existing revalidate tick (keeps your “wake up” behavior)
  const rvTick = useRevalidate();
  const lastRvAtRef = useRef<number>(0);

  const seenRef = useRef<Set<string>>(new Set());

  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const backoffStepRef = useRef(0);

  // abort in-flight fetches when a new one starts
  const abortRef = useRef<AbortController | null>(null);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = useCallback((ms: number) => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      void load(true);
    }, ms);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ listen for optimistic activity inserts
  useEffect(() => {
    const onOptimistic = (ev: Event) => {
      const d = (ev as CustomEvent).detail as Partial<LocalActivityItem> | null;
      if (!d?.txHash) return;

      const now = Math.floor(Date.now() / 1000);
      const item: LocalActivityItem = {
        type: (d.type as any) ?? "BUY",
        raffleId: String(d.raffleId ?? ""),
        raffleName: String(d.raffleName ?? "Pending..."),
        subject: String(d.subject ?? "0x"),
        value: String(d.value ?? "0"),
        timestamp: String(d.timestamp ?? now),
        txHash: String(d.txHash),
        pending: true,
        pendingLabel: d.pendingLabel ? String(d.pendingLabel) : "Pending",
      };

      setItems((prev) => {
        const next = [item, ...prev.filter((x) => x.txHash !== item.txHash)];
        return next.slice(0, 20);
      });

      // keep "x ago" display reasonably fresh after optimistic updates
      setNowSec(Math.floor(Date.now() / 1000));
    };

    window.addEventListener("ppopgi:activity", onOptimistic as any);
    return () => window.removeEventListener("ppopgi:activity", onOptimistic as any);
  }, []);

  const load = useCallback(
    async (isBackground = false) => {
      // if hidden, keep it cheap (but still try again later)
      if (isBackground && isHidden()) {
        scheduleNext(60_000);
        return;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (!isBackground && items.length === 0) setLoading(true);

      // abort any in-flight request
      try {
        abortRef.current?.abort();
      } catch {}
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        // If your fetchGlobalActivity supports signal, pass it through.
        // If not, you can remove the second argument below.
        const data = await fetchGlobalActivity({ first: 15 } as any, { signal: ac.signal } as any);

        if (ac.signal.aborted) return;

        setItems((prev) => {
          const pending = prev.filter((x) => x.pending);
          const real = (data ?? []) as LocalActivityItem[];

          const realHashes = new Set(real.map((x) => x.txHash));
          const stillPending = pending.filter((p) => !realHashes.has(p.txHash));

          return [...stillPending, ...real].slice(0, 20);
        });

        setLoading(false);
        setNowSec(Math.floor(Date.now() / 1000));

        backoffStepRef.current = 0;

        // ✅ 5s refresh while visible
        scheduleNext(REFRESH_MS);
      } catch (e: any) {
        if (String(e?.name || "").toLowerCase().includes("abort")) return;
        if (String(e).toLowerCase().includes("abort")) return;

        console.error("[ActivityBoard] load failed", e);

        if (isRateLimitError(e)) {
          backoffStepRef.current = Math.min(backoffStepRef.current + 1, 5);
          const delays = [10_000, 15_000, 30_000, 60_000, 120_000, 120_000];
          scheduleNext(delays[backoffStepRef.current]);
        } else {
          scheduleNext(isBackground ? 15_000 : 10_000);
        }

        setLoading(false);
      } finally {
        inFlightRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length, scheduleNext]
  );

  useEffect(() => {
    void load(false);

    const onFocus = () => void load(true);
    const onVis = () => {
      if (!isHidden()) void load(true);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      clearTimer();
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, [load]);

  // keep your revalidate hook behavior (fast wake-up), but not too aggressive
  useEffect(() => {
    if (rvTick === 0) return;

    const now = Date.now();
    if (now - lastRvAtRef.current < 5_000) return; // was 2s; a bit calmer
    lastRvAtRef.current = now;

    if (isHidden()) return;
    void load(true);
  }, [rvTick, load]);

  const rowsWithFlags = useMemo(() => {
    return (items ?? []).map((it) => {
      const stableKey = String(it.txHash || "");
      const already = stableKey ? seenRef.current.has(stableKey) : false;
      const enter = stableKey ? !already : false;

      if (stableKey && !already) seenRef.current.add(stableKey);

      const reactKey = stableKey || `${it.type}-${it.raffleId}-${it.timestamp}-${it.subject}`;
      return { it, key: reactKey, enter };
    });
  }, [items]);

  if (loading && items.length === 0) {
    return (
      <div className="ab-board">
        <div className="ab-loading">Loading...</div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="ab-board">
      <div className="ab-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="ab-pulse" />
          <span>Live Feed</span>
        </div>

        {/* ✅ removed "Updated Xs ago" */}
      </div>

      <div className="ab-list">
        {rowsWithFlags.map(({ it: item, key, enter }) => {
          const isBuy = item.type === "BUY";
          const isWin = (item as any).type === "WIN";
          const isCancel = (item as any).type === "CANCEL";

          let icon = "✨";
          let iconClass = "create";
          if (isBuy) {
            icon = "🎟️";
            iconClass = "buy";
          }
          if (isWin) {
            icon = "🏆";
            iconClass = "win";
          }
          if (isCancel) {
            icon = "⛔";
            iconClass = "cancel";
          }

          const fresh = isFresh(item.timestamp, 10);

          const rowClass = [
            "ab-row",
            enter ? "ab-enter" : "",
            fresh ? `ab-fresh ab-fresh-${iconClass}` : "",
            item.pending ? "ab-pending" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={key} className={rowClass}>
              <div className={`ab-icon ${iconClass}`}>{icon}</div>

              <div className="ab-content">
                <div className="ab-main-text">
                  {isCancel ? (
                    <>
                      <a href={`/?raffle=${item.raffleId}`} className="ab-link">
                        {item.raffleName}
                      </a>{" "}
                      got <b style={{ color: "#991b1b" }}>canceled</b> due to min ticket not reached
                    </>
                  ) : (
                    <>
                      <a
                        href={`https://explorer.etherlink.com/address/${item.subject}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ab-user"
                      >
                        {shortAddr(item.subject)}
                      </a>

                      {isBuy && (
                        <>
                          {" "}
                          bought <b>{item.value} tix</b> in{" "}
                        </>
                      )}

                      {!isBuy && !isWin && <> created </>}

                      {isWin && (
                        <>
                          {" "}
                          <b style={{ color: "#166534" }}>won</b> the pot on{" "}
                        </>
                      )}

                      <a href={`/?raffle=${item.raffleId}`} className="ab-link">
                        {item.raffleName}
                      </a>
                    </>
                  )}
                </div>

                <div className="ab-meta">
                  <span className="ab-time">
                    {timeAgoFrom(nowSec, item.timestamp)}
                    {fresh && <span className="ab-new-pill">NEW</span>}
                    {item.pending && (
                      <span
                        className="ab-new-pill"
                        style={{ marginLeft: 6, background: "rgba(2,132,199,.12)", color: "#075985" }}
                      >
                        {item.pendingLabel || "PENDING"}
                      </span>
                    )}
                  </span>

                  {!isBuy && (
                    <span className={`ab-pot-tag ${isWin ? "win" : isCancel ? "cancel" : ""}`}>
                      {isWin ? "Won: " : isCancel ? "Refunded" : "Pot: "}
                      {!isCancel && formatUnits(item.value, 6)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActivityBoard;