// src/components/NotificationCenter.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useActivityStore } from "../hooks/useActivityStore";
import { useLotteryStore } from "../hooks/useLotteryStore";
import { useConfetti } from "../hooks/useConfetti";
import { fmtUsdcUi } from "../lib/format";
import { formatUnits } from "ethers";
import { fetchGlobalActivity } from "../indexer/subgraph";
import "./NotificationCenter.css";

type ActivityItem = {
  type: "BUY" | "CREATE" | "WIN" | "CANCEL";
  lotteryId: string;
  lotteryName: string;
  subject: string;
  value: string;
  timestamp: string;
  txHash: string;
  pending?: boolean;
};

type ToastKind = "info" | "success" | "danger";

type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  showConfetti?: boolean;
};

// Structured line item for perfect alignment
type SummaryLine = {
  icon: string;
  text: string;
  time: string;
};

type SummaryModal = {
  id: string;
  title: string;
  lines: SummaryLine[];
};

const TOAST_MS = 3000;

const LS_TOASTS_ENABLED_A = "ppopgi:toastEnabled";
const LS_TOASTS_ENABLED_B = "ppopgi_toasts_enabled";

const LS_LAST_SEEN_PREFIX = "ppopgi_last_seen_";
const LS_PARTICIPATED_PREFIX = "ppopgi_participated_";

function lc(a: string | null | undefined) {
  return String(a || "").toLowerCase();
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function parseSec(s: string) {
  const n = Number(s || "0");
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function fmtUsdcFromU6(u6: string) {
  try {
    const s = formatUnits(BigInt(u6 || "0"), 6);
    return fmtUsdcUi(s);
  } catch {
    return "0";
  }
}

// Short format for list alignment (e.g. "Mar 3, 14:07")
function fmtWhen(tsSecStr: string) {
  const sec = parseSec(tsSecStr);
  if (!sec) return "";
  const d = new Date(sec * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, v: any) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

function readToastsEnabled(): boolean {
  try {
    const vA = localStorage.getItem(LS_TOASTS_ENABLED_A);
    if (vA != null) return vA === "true";
    const vB = localStorage.getItem(LS_TOASTS_ENABLED_B);
    if (vB != null) return vB === "true";
    return true;
  } catch {
    return true;
  }
}

function setLastSeen(account: string, tsSec: number) {
  try {
    localStorage.setItem(`${LS_LAST_SEEN_PREFIX}${lc(account)}`, String(tsSec));
  } catch {}
}

function getLastSeen(account: string): number {
  try {
    const raw = localStorage.getItem(`${LS_LAST_SEEN_PREFIX}${lc(account)}`);
    const n = Number(raw || "0");
    return Number.isFinite(n) ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function getParticipatedSet(account: string): Set<string> {
  const key = `${LS_PARTICIPATED_PREFIX}${lc(account)}`;
  const arr = loadJson<string[]>(key, []);
  return new Set((arr || []).map((x) => lc(x)));
}

function addParticipated(account: string, lotteryId: string) {
  const key = `${LS_PARTICIPATED_PREFIX}${lc(account)}`;
  const set = getParticipatedSet(account);
  set.add(lc(lotteryId));
  saveJson(key, Array.from(set));
}

function shortAddr(a: string) {
  const s = lc(a);
  if (!s) return "—";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function NotificationCenter() {
  const acct = useActiveAccount();
  const me = acct?.address ?? null;
  const meLc = lc(me);

  const { fireConfetti } = useConfetti();
  const activity = useActivityStore();
  const lotteryStore = useLotteryStore("notif-center", 60_000);

  const [toastsEnabled, setToastsEnabled] = useState<boolean>(() => readToastsEnabled());
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [summary, setSummary] = useState<SummaryModal | null>(null);

  // ✅ NEW: toggle “Show more / Show less” inside summary modal
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const clearToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const clearSummary = useCallback(() => {
    setSummary(null);
    setSummaryExpanded(false);
  }, []);

  const showToast = useCallback(
    (t: Toast) => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
      setToast(t);

      if (t.showConfetti) {
        try {
          fireConfetti();
        } catch {}
      }

      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, TOAST_MS);
    },
    [fireConfetti]
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Listen for TopNav toggle changes instantly
  useEffect(() => {
    const onSettingA = (ev: Event) => {
      const d = (ev as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof d?.enabled === "boolean") setToastsEnabled(d.enabled);
      else setToastsEnabled(readToastsEnabled());
    };
    const onSettingB = () => setToastsEnabled(readToastsEnabled());

    window.addEventListener("ppopgi:toast-pref", onSettingA as any);
    window.addEventListener("ppopgi:toast-setting", onSettingB as any);

    return () => {
      window.removeEventListener("ppopgi:toast-pref", onSettingA as any);
      window.removeEventListener("ppopgi:toast-setting", onSettingB as any);
    };
  }, []);

  const creatorOf = useCallback(
    (lotteryId: string) => {
      const id = lc(lotteryId);
      const it = (lotteryStore.items || []).find((x: any) => lc(String(x?.id || "")) === id);
      return lc(String((it as any)?.creator || (it as any)?.owner || "")) || "";
    },
    [lotteryStore.items]
  );

  const isParticipant = useCallback(
    (lotteryId: string) => {
      if (!me) return false;
      const set = getParticipatedSet(me);
      return set.has(lc(lotteryId));
    },
    [me]
  );

  // Real-time popups
  useEffect(() => {
    if (!me) return;

    const onActivity = (ev: Event) => {
      if (!toastsEnabled) return;
      if (summary) return;

      const d = (ev as CustomEvent<ActivityItem>).detail;
      if (!d?.lotteryId || !d?.type) return;
      if (d.pending) return;

      const type = d.type;
      const lotId = lc(d.lotteryId);
      const name = String(d.lotteryName || "Lottery");
      const subj = lc(d.subject);
      const value = String(d.value || "0");

      if (type === "BUY" && subj === meLc) {
        addParticipated(me, lotId);
        return;
      }

      const creator = creatorOf(lotId);
      const amCreator = creator && creator === meLc;
      const amParticipant = isParticipant(lotId);

      if (type === "BUY" && amCreator && subj !== meLc) {
        showToast({
          id: `t:${d.txHash}`,
          kind: "info",
          title: `🎟️ Ticket Sale`,
          body: `${value} tickets sold on “${name}” to ${shortAddr(subj)}.`,
        });
        return;
      }

      if (type === "CANCEL" && amParticipant) {
        showToast({
          id: `t:${d.txHash}`,
          kind: "danger",
          title: `⛔ Lottery Canceled`,
          body: `“${name}” did not reach min tickets. Refund available.`,
        });
        return;
      }

      if (type === "CANCEL" && amCreator) {
        showToast({
          id: `t:${d.txHash}`,
          kind: "danger",
          title: `⛔ Lottery Canceled`,
          body: `“${name}” was canceled (min tickets not reached).`,
        });
        return;
      }

      if (type === "WIN") {
        const potUi = fmtUsdcFromU6(value);

        // winner
        if (subj === meLc) {
          showToast({
            id: `t:${d.txHash}`,
            kind: "success",
            title: `🏆 You Won!`,
            body: `Congratulations! You won ${potUi} USDC on “${name}”.`,
            showConfetti: true,
          });
          return;
        }

        if (amParticipant) {
          showToast({
            id: `t:${d.txHash}`,
            kind: "info",
            title: `✅ Round Ended`,
            body: `“${name}” finalized. Winner: ${shortAddr(subj)}.`,
          });
          return;
        }

        if (amCreator) {
          showToast({
            id: `t:${d.txHash}`,
            kind: "success",
            title: `🏁 Winner Picked`,
            body: `“${name}” is complete. Ticket revenue is ready.`,
          });
          return;
        }
      }
    };

    window.addEventListener("ppopgi:activity", onActivity as any);
    return () => window.removeEventListener("ppopgi:activity", onActivity as any);
  }, [me, meLc, toastsEnabled, creatorOf, isParticipant, showToast, summary]);

  const inFlightSummaryRef = useRef(false);

  const openDashboard = useCallback(() => {
    clearSummary();
    try {
      window.dispatchEvent(new CustomEvent("ppopgi:navigate", { detail: { page: "dashboard" } }));
    } catch {
      window.location.href = "/?page=dashboard";
    }
  }, [clearSummary]);

  const buildSummaryLines = useCallback(
    (items: ActivityItem[]): SummaryLine[] => {
      if (!me) return [];

      const participated = getParticipatedSet(me);
      const lines: SummaryLine[] = [];

      for (const it of items) {
        const type = it.type;
        const lotId = lc(it.lotteryId);
        const name = String(it.lotteryName || "Lottery");
        const subj = lc(it.subject);
        const when = fmtWhen(it.timestamp);

        const creator = creatorOf(lotId);
        const amCreator = creator && creator === meLc;
        const amParticipant = participated.has(lotId);

        if (type === "BUY" && amCreator && subj !== meLc) {
          lines.push({ icon: "🎟️", text: `${it.value} tickets sold on “${name}”`, time: when });
          continue;
        }

        if (type === "CANCEL") {
          if (amParticipant) lines.push({ icon: "⛔", text: `“${name}” canceled (refund available)`, time: when });
          else if (amCreator) lines.push({ icon: "⛔", text: `Your lottery “${name}” canceled`, time: when });
          continue;
        }

        if (type === "WIN") {
          const potUi = fmtUsdcFromU6(it.value);

          if (subj === meLc) {
            lines.push({ icon: "🏆", text: `YOU WON ${potUi} USDC on “${name}”!`, time: when });
            continue;
          }

          if (amParticipant) {
            lines.push({ icon: "✅", text: `“${name}” finalized`, time: when });
            continue;
          }

          if (amCreator) {
            lines.push({ icon: "🏁", text: `“${name}” finished successfully`, time: when });
            continue;
          }
        }
      }

      return lines;
    },
    [me, meLc, creatorOf]
  );

  const maybeShowSummary = useCallback(async () => {
    if (!me) return;
    if (summary) return;
    if (inFlightSummaryRef.current) return;
    inFlightSummaryRef.current = true;

    try {
      const lastSeen = getLastSeen(me);

      // First time device/cache: show summary if relevant exists
      if (!lastSeen) {
        const latest = await fetchGlobalActivity({ first: 50, forceFresh: true });
        const items = (latest || []).filter((x: any) => !x?.pending) as ActivityItem[];

        const newestTs = Math.max(0, ...items.map((it) => parseSec(String(it?.timestamp || "0"))));
        setLastSeen(me, newestTs > 0 ? newestTs : nowSec());

        const lines = buildSummaryLines(items);
        if (lines.length === 0) return;

        setSummaryExpanded(false);
        setSummary({
          id: `summary:first:${newestTs || Date.now()}`,
          title: "While you were away",
          lines,
        });
        return;
      }

      // Normal: fetch only since lastSeen
      const sinceItemsRaw = await fetchGlobalActivity({
        first: 50,
        sinceSec: lastSeen,
        forceFresh: true,
      });

      const sinceItems = (sinceItemsRaw || []).filter((x: any) => !x?.pending) as ActivityItem[];
      if (sinceItems.length === 0) return;

      const newestTs = Math.max(...sinceItems.map((it) => parseSec(it.timestamp)));
      if (newestTs > 0) setLastSeen(me, newestTs);

      const lines = buildSummaryLines(sinceItems);
      if (lines.length === 0) return;

      setSummaryExpanded(false);
      setSummary({
        id: `summary:${newestTs || Date.now()}`,
        title: "While you were away",
        lines,
      });
    } catch {
      // no-op
    } finally {
      inFlightSummaryRef.current = false;
    }
  }, [me, summary, buildSummaryLines]);

  useEffect(() => {
    if (!me) return;
    void maybeShowSummary();

    const onFocus = () => void maybeShowSummary();
    const onVis = () => {
      if (document.visibilityState === "visible") void maybeShowSummary();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [me, maybeShowSummary, activity.lastUpdatedMs]);

  // ---- RENDER ----
  if (!toast && !summary) return null;

  // 1) SUMMARY MODAL
  if (summary) {
    const collapsedCount = 8;
    const canExpand = summary.lines.length > collapsedCount;

    const visibleLines = summaryExpanded ? summary.lines : summary.lines.slice(0, collapsedCount);

    return (
      <div className="pp-toast-wrap is-modal show" onMouseDown={clearSummary}>
        <div className="pp-toast pp-modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="pp-toast-header">
            <div className="pp-toast-title">👋 {summary.title}</div>
            <button className="pp-modal-close" onClick={clearSummary}>
              ✕
            </button>
          </div>

          <div className="pp-toast-body">
            <ul className="pp-summary-list">
              {visibleLines.map((line, idx) => (
                <li key={`${summary.id}:${idx}`}>
                  <div className="pp-sl-left">
                    <span className="pp-sl-icon">{line.icon}</span>
                    <span className="pp-sl-text">{line.text}</span>
                  </div>
                  <div className="pp-sl-time">{line.time}</div>
                </li>
              ))}
            </ul>

            {/* ✅ NEW: Show more / Show less */}
            {canExpand && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                <button
                  type="button"
                  className="pp-btn secondary"
                  onClick={() => setSummaryExpanded((v) => !v)}
                  style={{ maxWidth: 220 }}
                >
                  {summaryExpanded
                    ? "Show less"
                    : `Show more (${summary.lines.length - collapsedCount})`}
                </button>
              </div>
            )}

            <div className="pp-modal-actions">
              <button onClick={openDashboard} className="pp-btn primary">
                Go to Dashboard
              </button>
              <button onClick={clearSummary} className="pp-btn secondary">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2) EPHEMERAL TOAST
  return (
    <div className={`pp-toast-wrap is-toast ${toast ? "show" : ""}`}>
      <div className={`pp-toast pp-${toast!.kind}`} onClick={clearToast}>
        <div className="pp-toast-icon">
          {toast!.kind === "success" ? "🎉" : toast!.kind === "danger" ? "⚠️" : "🔔"}
        </div>
        <div className="pp-toast-content">
          <div className="pp-toast-title">{toast!.title}</div>
          {toast!.body && <div className="pp-toast-message">{toast!.body}</div>}
        </div>
      </div>
    </div>
  );
}