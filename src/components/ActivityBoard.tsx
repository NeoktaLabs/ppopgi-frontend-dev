// src/components/ActivityBoard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "ethers";
import { useActivityStore } from "../hooks/useActivityStore";
import "./ActivityBoard.css";

const NEW_WINDOW_SEC = 30;

const shortAddr = (s: string) => (s ? `${s.slice(0, 4)}...${s.slice(-4)}` : "—");

function isFresh(ts: string, seconds = NEW_WINDOW_SEC) {
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
  // ✅ Single source of truth (singleton store). It can poll every 5s globally.
  const { items, isLoading } = useActivityStore();

  // Tick every second so "NEW" + time-ago update smoothly
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(t);
  }, []);

  const seenRef = useRef<Set<string>>(new Set());

  const rowsWithFlags = useMemo(() => {
    return (items ?? []).map((it) => {
      const stableKey = String((it as any).txHash || "");
      const already = stableKey ? seenRef.current.has(stableKey) : false;
      const enter = stableKey ? !already : false;

      if (stableKey && !already) seenRef.current.add(stableKey);

      const reactKey = stableKey || `${(it as any).type}-${(it as any).raffleId}-${(it as any).timestamp}-${(it as any).subject}`;
      return { it, key: reactKey, enter };
    });
  }, [items]);

  if (isLoading && (!items || items.length === 0)) {
    return (
      <div className="ab-board">
        <div className="ab-loading">Loading...</div>
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="ab-board">
      <div className="ab-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="ab-pulse" />
          <span>Live Feed</span>
        </div>
      </div>

      <div className="ab-list">
        {rowsWithFlags.map(({ it: item, key, enter }) => {
          const type = String((item as any).type || "");
          const isBuy = type === "BUY";
          const isWin = type === "WIN";
          const isCancel = type === "CANCEL";

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

          const fresh = isFresh(String((item as any).timestamp || "0"), NEW_WINDOW_SEC);

          const rowClass = [
            "ab-row",
            enter ? "ab-enter" : "",
            fresh ? `ab-fresh ab-fresh-${iconClass}` : "",
            (item as any).pending ? "ab-pending" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const raffleId = String((item as any).raffleId || "");
          const raffleName = String((item as any).raffleName || "—");
          const subject = String((item as any).subject || "");
          const value = String((item as any).value || "0");
          const timestamp = String((item as any).timestamp || "0");
          const pendingLabel = String((item as any).pendingLabel || "PENDING");
          const pending = !!(item as any).pending;

          return (
            <div key={key} className={rowClass}>
              <div className={`ab-icon ${iconClass}`}>{icon}</div>

              <div className="ab-content">
                <div className="ab-main-text">
                  {isCancel ? (
                    <>
                      <a href={`/?raffle=${raffleId}`} className="ab-link">
                        {raffleName}
                      </a>{" "}
                      got <b style={{ color: "#991b1b" }}>canceled</b> (min not reached)
                    </>
                  ) : (
                    <>
                      <a
                        href={`https://explorer.etherlink.com/address/${subject}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ab-user"
                      >
                        {shortAddr(subject)}
                      </a>

                      {isBuy && (
                        <>
                          {" "}
                          bought <b>{value} tix</b> in{" "}
                        </>
                      )}

                      {!isBuy && !isWin && <> created </>}

                      {isWin && (
                        <>
                          {" "}
                          <b style={{ color: "#166534" }}>won</b> the pot on{" "}
                        </>
                      )}

                      <a href={`/?raffle=${raffleId}`} className="ab-link">
                        {raffleName}
                      </a>
                    </>
                  )}
                </div>

                <div className="ab-meta">
                  <span className="ab-time">
                    {timeAgoFrom(nowSec, timestamp)}
                    {fresh && <span className="ab-new-pill">NEW</span>}
                    {pending && (
                      <span
                        className="ab-new-pill"
                        style={{ marginLeft: 6, background: "rgba(2,132,199,.12)", color: "#075985" }}
                      >
                        {pendingLabel}
                      </span>
                    )}
                  </span>

                  {!isBuy && (
                    <span className={`ab-pot-tag ${isWin ? "win" : isCancel ? "cancel" : ""}`}>
                      {isWin ? "Won: " : isCancel ? "Refunded" : "Pot: "}
                      {!isCancel && formatUnits(value, 6)}
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