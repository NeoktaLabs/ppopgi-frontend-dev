// src/components/NotificationCenter.tsx
import { useCallback, useEffect, useRef, useState } from "react";
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
  subject: string; // buyer/creator/winner (depending on type)
  value: string; // BUY: ticket count | WIN: prize pot (u6) | CANCEL: "0" | CREATE maybe pot (u6)
  timestamp: string; // seconds
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

type SummaryModal = {
  id: string;
  title: string;
  lines: string[];
};

const TOAST_MS = 2000;

// TopNav’s key / event (keep consistent)
const LS_TOASTS_ENABLED_A = "ppopgi:toastEnabled";
const LS_TOASTS_ENABLED_B = "ppopgi_toasts_enabled"; // legacy fallback

const LS_LAST_SEEN_PREFIX = "ppopgi_last_seen_"; // per account
const LS_PARTICIPATED_PREFIX = "ppopgi_participated_"; // per account (set of lotteryIds)

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

    return true; // default ON
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

  // Live feed store (kept for general app freshness; not used to build “while away”)
  const activity = useActivityStore();

  // Cached lottery list so we can infer creator quickly without extra RPC calls
  const lotteryStore = useLotteryStore("notif-center", 60_000);

  // toast toggle (real-time only)
  const [toastsEnabled, setToastsEnabled] = useState<boolean>(() => readToastsEnabled());

  // ephemeral toast state
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // persistent summary modal state
  const [summary, setSummary] = useState<SummaryModal | null>(null);

  // ✅ Prevent “same click” from instantly closing the summary
  const summaryOpenedAtMsRef = useRef<number>(0);

  const clearToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const clearSummary = useCallback(() => {
    setSummary(null);
  }, []);

  const showToast = useCallback(
    (t: Toast) => {
      setToast(t);

      if (t.showConfetti) {
        try {
          fireConfetti();
        } catch {}
      }

      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_MS);
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

    // accept both in case you used older event names earlier
    const onSettingB = () => setToastsEnabled(readToastsEnabled());

    window.addEventListener("ppopgi:toast-pref", onSettingA as any);
    window.addEventListener("ppopgi:toast-setting", onSettingB as any);

    return () => {
      window.removeEventListener("ppopgi:toast-pref", onSettingA as any);
      window.removeEventListener("ppopgi:toast-setting", onSettingB as any);
    };
  }, []);

  // helper: lookup creator quickly from cached lottery list items
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

  // Real-time popups: listen to ppopgi:activity
  useEffect(() => {
    if (!me) return;

    const onActivity = (ev: Event) => {
      if (!toastsEnabled) return; // toggle affects ONLY real-time
      if (summary) return; // don’t distract while summary modal is open

      const d = (ev as CustomEvent<ActivityItem>).detail;
      if (!d?.lotteryId || !d?.type) return;
      if (d.pending) return;

      const type = d.type;
      const lotId = lc(d.lotteryId);
      const name = String(d.lotteryName || "Lottery");
      const subj = lc(d.subject);
      const value = String(d.value || "0");

      // Track participation on BUY by me (for future “away” relevance)
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
          title: `🎟️ New tickets sold`,
          body: `${value} tix bought by ${shortAddr(subj)} in “${name}”.`,
        });
        return;
      }

      if (type === "CANCEL" && amParticipant) {
        showToast({
          id: `t:${d.txHash}`,
          kind: "danger",
          title: `⛔ Lottery canceled`,
          body: `“${name}” was canceled (min tickets not reached). Go to Dashboard to reclaim.`,
        });
        return;
      }

      if (type === "CANCEL" && amCreator) {
        showToast({
          id: `t:${d.txHash}`,
          kind: "danger",
          title: `⛔ Your lottery was canceled`,
          body: `“${name}” was canceled (min tickets not reached).`,
        });
        return;
      }

      if (type === "WIN") {
        const potUi = fmtUsdcFromU6(value);

        if (amParticipant) {
          if (subj === meLc) {
            showToast({
              id: `t:${d.txHash}`,
              kind: "success",
              title: `🏆 Congratulations!`,
              body: `You won ${potUi} USDC on “${name}”. Go to Dashboard to reclaim your prize!`,
              showConfetti: true,
            });
          } else {
            showToast({
              id: `t:${d.txHash}`,
              kind: "info",
              title: `✅ Lottery finalized`,
              body: `“${name}” finalized and you didn’t win this time.`,
            });
          }
          return;
        }

        if (amCreator) {
          showToast({
            id: `t:${d.txHash}`,
            kind: "success",
            title: `🏁 Your lottery has a winner`,
            body: `“${name}” picked a winner. Go to Dashboard to reclaim the ticket sales pot!`,
          });
          return;
        }
      }
    };

    window.addEventListener("ppopgi:activity", onActivity as any);
    return () => window.removeEventListener("ppopgi:activity", onActivity as any);
  }, [me, meLc, toastsEnabled, creatorOf, isParticipant, showToast, summary]);

  // “While you were away” (ALWAYS ON; NOT controlled by toggle)
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
    (sinceItems: ActivityItem[]) => {
      if (!me) return [];

      const participated = getParticipatedSet(me);
      const lines: string[] = [];

      for (const it of sinceItems) {
        const type = it.type;
        const lotId = lc(it.lotteryId);
        const name = String(it.lotteryName || "Lottery");
        const subj = lc(it.subject);

        const creator = creatorOf(lotId);
        const amCreator = creator && creator === meLc;
        const amParticipant = participated.has(lotId);

        // creator: buys by others (don’t cumulate; one line per event)
        if (type === "BUY" && amCreator && subj !== meLc) {
          lines.push(`🎟️ ${it.value} tickets on “${name}” by ${shortAddr(subj)}`);
          continue;
        }

        // cancel
        if (type === "CANCEL") {
          if (amParticipant) lines.push(`⛔ “${name}” canceled — reclaim in Dashboard`);
          else if (amCreator) lines.push(`⛔ Your lottery “${name}” canceled`);
          continue;
        }

        // win
        if (type === "WIN") {
          const potUi = fmtUsdcFromU6(it.value);

          if (amParticipant) {
            if (subj === meLc) lines.push(`🏆 You won ${potUi} USDC on “${name}” — reclaim in Dashboard`);
            else lines.push(`✅ “${name}” finalized — you didn’t win this time`);
            continue;
          }

          if (amCreator) {
            lines.push(`🏁 “${name}” picked a winner — reclaim ticket sales pot in Dashboard`);
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

      // ✅ First time on this device: set baseline to latest on-chain activity timestamp (no modal)
      if (!lastSeen) {
        const latest = await fetchGlobalActivity({ first: 10, forceFresh: true });
        const newestTs = Math.max(0, ...(latest || []).map((it: any) => parseSec(String(it?.timestamp || "0"))));
        setLastSeen(me, newestTs > 0 ? newestTs : nowSec());
        return;
      }

      // ✅ Pull only since lastSeen (your subgraph fetch must support this)
      const sinceItemsRaw = await fetchGlobalActivity({
        first: 50,
        sinceSec: lastSeen, // requires fetchGlobalActivity to accept & apply timestamp_gt
        forceFresh: true,
      } as any);

      const sinceItems = (sinceItemsRaw || []).filter((x: any) => !x?.pending) as ActivityItem[];
      if (sinceItems.length === 0) return;

      const newestTs = Math.max(...sinceItems.map((it) => parseSec(it.timestamp)));
      if (newestTs > 0) setLastSeen(me, newestTs);

      const lines = buildSummaryLines(sinceItems);
      if (lines.length === 0) return; // ✅ “if nothing happened” => no modal

      // ✅ record open time to ignore immediate outside click
      summaryOpenedAtMsRef.current = Date.now();

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

  // ---- render ----
  if (!toast && !summary) return null;

  // Summary modal (persistent)
  if (summary) {
    return (
      <div
        className="pp-toast-wrap show"
        onClick={() => {
          // ✅ ignore the click that triggered this modal (or any immediate click)
          if (Date.now() - summaryOpenedAtMsRef.current < 600) return;
          clearSummary();
        }}
        role="presentation"
      >
        <div className="pp-toast pp-info" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div className="pp-toast-title">{summary.title}</div>
            <button
              type="button"
              onClick={clearSummary}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,.08)",
                background: "rgba(255,255,255,.7)",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              ✕
            </button>
          </div>

          <div className="pp-toast-body" style={{ marginTop: 10 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {summary.lines.slice(0, 10).map((line, idx) => (
                <div key={`${summary.id}:${idx}`} style={{ opacity: 0.95 }}>
                  • {line}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={openDashboard}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.08)",
                  background: "rgba(255,255,255,.75)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Go to Dashboard ↗
              </button>

              <button
                type="button"
                onClick={clearSummary}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.08)",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 800,
                  opacity: 0.85,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ephemeral toast (2s)
  return (
    <div className={`pp-toast-wrap ${toast ? "show" : ""}`} onMouseDown={clearToast} role="presentation">
      <div
        className={`pp-toast pp-${toast!.kind}`}
        role="status"
        aria-live="polite"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pp-toast-title">{toast!.title}</div>
        {toast!.body && <div className="pp-toast-body">{toast!.body}</div>}
      </div>
    </div>
  );
}