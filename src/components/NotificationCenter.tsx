// src/components/NotificationCenter.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useActivityStore } from "../hooks/useActivityStore";
import { useLotteryStore } from "../hooks/useLotteryStore";
import { useConfetti } from "../hooks/useConfetti";
import { fmtUsdcUi } from "../lib/format";
import { formatUnits } from "ethers";
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

// Real-time popups only
const TOAST_MS = 2000;

// --- Storage keys ---
// NOTE: You have two variants in your codebase (older + newer). We support BOTH.
const LS_TOASTS_ENABLED_OLD = "ppopgi_toasts_enabled";
const LS_TOASTS_ENABLED_NEW = "ppopgi:toastEnabled"; // from TopNav

const LS_LAST_SEEN_PREFIX = "ppopgi_last_seen_"; // per account
const LS_PARTICIPATED_PREFIX = "ppopgi_participated_"; // per account (set of lotteryIds)

function lc(a: string | null | undefined) {
  return String(a || "").toLowerCase();
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
    // Prefer the newer key if present
    const vNew = localStorage.getItem(LS_TOASTS_ENABLED_NEW);
    if (vNew != null) return vNew === "true";

    // Fallback old key
    const vOld = localStorage.getItem(LS_TOASTS_ENABLED_OLD);
    if (vOld == null) return true; // default ON
    return vOld === "true";
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

type AwaySummary = {
  id: string;
  title: string;
  bodyLines: string[];
};

export function NotificationCenter() {
  const acct = useActiveAccount();
  const me = acct?.address ?? null;
  const meLc = lc(me);

  const { fireConfetti } = useConfetti();

  // ✅ singleton store; does NOT add extra fast polling
  const activity = useActivityStore();

  // ✅ cached list used to infer creator (no extra RPC)
  const lotteryStore = useLotteryStore("notif-center", 60_000);

  // real-time toast toggle (ONLY for popups)
  const [toastsEnabled, setToastsEnabled] = useState<boolean>(() => readToastsEnabled());

  // live toast state
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // "While you were away" modal state (NOT affected by toggle)
  const [away, setAway] = useState<AwaySummary | null>(null);

  const clearToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
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
    const onPref = (ev: Event) => {
      const d = (ev as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof d?.enabled === "boolean") setToastsEnabled(d.enabled);
      else setToastsEnabled(readToastsEnabled());
    };

    // support both event names just in case
    window.addEventListener("ppopgi:toast-pref", onPref as any);
    window.addEventListener("ppopgi:toast-setting", onPref as any);

    return () => {
      window.removeEventListener("ppopgi:toast-pref", onPref as any);
      window.removeEventListener("ppopgi:toast-setting", onPref as any);
    };
  }, []);

  // helper: lookup creator from cached list items
  const creatorOf = useCallback(
    (lotteryId: string) => {
      const id = lc(lotteryId);
      const it = (lotteryStore.items || []).find((x: any) => lc(String(x?.id || "")) === id);
      const c = lc(String((it as any)?.creator || (it as any)?.owner || ""));
      return c || "";
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

  // 1) Real-time popups: listen to ppopgi:activity
  useEffect(() => {
    if (!me) return;

    const onActivity = (ev: Event) => {
      if (!toastsEnabled) return; // ✅ toggle affects ONLY real-time

      const d = (ev as CustomEvent<ActivityItem>).detail;
      if (!d?.lotteryId || !d?.type) return;
      if (d.pending) return;

      const type = d.type;
      const lotId = lc(d.lotteryId);
      const name = String(d.lotteryName || "Lottery");
      const subj = lc(d.subject);
      const value = String(d.value || "0");

      // Track participation on BUY by me
      if (type === "BUY" && subj === meLc) {
        addParticipated(me, lotId);
        return;
      }

      const creator = creatorOf(lotId);
      const amCreator = creator && creator === meLc;
      const amParticipant = isParticipant(lotId);

      // CREATOR: someone bought tickets on my lottery
      if (type === "BUY" && amCreator && subj !== meLc) {
        showToast({
          id: `t:${d.txHash}`,
          kind: "info",
          title: `🎟️ New tickets sold`,
          body: `${value} tix bought by ${subj.slice(0, 6)}…${subj.slice(-4)} in “${name}”.`,
        });
        return;
      }

      // PARTICIPANT: lottery canceled
      if (type === "CANCEL" && amParticipant) {
        showToast({
          id: `t:${d.txHash}`,
          kind: "danger",
          title: `⛔ Lottery canceled`,
          body: `“${name}” was canceled (min tickets not reached). Go to Dashboard to reclaim.`,
        });
        return;
      }

      // CREATOR: lottery canceled
      if (type === "CANCEL" && amCreator) {
        showToast({
          id: `t:${d.txHash}`,
          kind: "danger",
          title: `⛔ Your lottery was canceled`,
          body: `“${name}” was canceled (min tickets not reached).`,
        });
        return;
      }

      // WIN: participant win/lose + creator winner info
      if (type === "WIN") {
        const potUi = fmtUsdcFromU6(value);

        // Participant
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

        // Creator
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
  }, [me, meLc, toastsEnabled, creatorOf, isParticipant, showToast]);

  // 2) “While you were away” summary (ALWAYS ON; NOT controlled by toggle)
  // ✅ Must NOT show if nothing relevant happened since lastSeen.
  const lastSummaryAtRef = useRef<number>(0);

  const buildAwaySummary = useCallback((): AwaySummary | null => {
    if (!me) return null;

    const items = (activity.items || []).filter((x: any) => !x?.pending) as ActivityItem[];
    if (items.length === 0) return null;

    const lastSeen = getLastSeen(me);
    const newestTs = Math.max(...items.map((it) => parseSec(it.timestamp)));
    if (newestTs <= 0) return null;

    const since = items.filter((it) => parseSec(it.timestamp) > lastSeen);
    if (since.length === 0) {
      // nothing happened at all since lastSeen => don't show anything
      // still advance lastSeen to newestTs (prevents old items re-processing)
      setLastSeen(me, newestTs);
      return null;
    }

    const now = Date.now();
    if (now - lastSummaryAtRef.current < 3000) return null;

    const participated = getParticipatedSet(me);

    let pWins = 0;
    let pLosses = 0;
    let pCancels = 0;
    let cBuys = 0;
    let cWins = 0;
    let cCancels = 0;

    for (const it of since) {
      const type = it.type;
      const lotId = lc(it.lotteryId);
      const subj = lc(it.subject);

      const creator = creatorOf(lotId);
      const amCreator = creator && creator === meLc;
      const amParticipant = participated.has(lotId);

      if (type === "BUY" && amCreator && subj !== meLc) cBuys += 1;

      if (type === "CANCEL") {
        if (amCreator) cCancels += 1;
        if (amParticipant) pCancels += 1;
      }

      if (type === "WIN") {
        if (amCreator) cWins += 1;
        if (amParticipant) {
          if (subj === meLc) pWins += 1;
          else pLosses += 1;
        }
      }
    }

    // Always advance lastSeen so we don't re-show the same period
    setLastSeen(me, newestTs);
    lastSummaryAtRef.current = now;

    const totalRelevant = pWins + pLosses + pCancels + cBuys + cWins + cCancels;

    // ✅ If nothing relevant happened, do NOT show the window.
    if (totalRelevant === 0) return null;

    const lines: string[] = [];
    if (pWins) lines.push(`🏆 You won ${pWins} time${pWins === 1 ? "" : "s"}.`);
    if (pLosses) lines.push(`✅ ${pLosses} lottery${pLosses === 1 ? "" : "ies"} finalized (no win).`);
    if (pCancels) lines.push(`⛔ ${pCancels} lottery${pCancels === 1 ? "" : "ies"} you joined got canceled.`);
    if (cBuys) lines.push(`🎟️ ${cBuys} ticket purchase${cBuys === 1 ? "" : "s"} on your lotteries.`);
    if (cWins) lines.push(`🏁 ${cWins} of your lotteries got a winner.`);
    if (cCancels) lines.push(`⛔ ${cCancels} of your lotteries got canceled.`);

    return {
      id: `away:${newestTs}`,
      title: "While you were away",
      bodyLines: lines,
    };
  }, [activity.items, me, meLc, creatorOf]);

  const maybeShowAway = useCallback(() => {
    if (!me) return;
    // Don't reopen if already open
    if (away) return;

    const summary = buildAwaySummary();
    if (!summary) return;

    setAway(summary);
  }, [me, away, buildAwaySummary]);

  useEffect(() => {
    if (!me) return;

    // on mount + focus/visible
    maybeShowAway();

    const onFocus = () => maybeShowAway();
    const onVis = () => {
      if (document.visibilityState === "visible") maybeShowAway();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [me, maybeShowAway]);

  const closeAway = useCallback(() => setAway(null), []);

  return (
    <>
      {/* =========================
          "While you were away" MODAL (persistent)
          ========================= */}
      {away && (
        <div
          className="pp-away-overlay"
          onMouseDown={closeAway} // click outside closes
          role="dialog"
          aria-modal="true"
        >
          <div
            className="pp-away-card"
            onMouseDown={(e) => e.stopPropagation()} // keep clicks inside
          >
            <div className="pp-away-header">
              <div className="pp-away-title">{away.title}</div>
              <button className="pp-away-close" onClick={closeAway} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="pp-away-body">
              {away.bodyLines.map((line, i) => (
                <div key={`${away.id}:${i}`} className="pp-away-line">
                  {line}
                </div>
              ))}

              <div className="pp-away-hint">
                Tip: check your <b>Dashboard</b> to reclaim prizes, ticket refunds, or creator pots.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          REAL-TIME TOAST (2s fade)
          ========================= */}
      {toast && (
        <div className={`pp-toast-wrap ${toast ? "show" : ""}`} onMouseDown={clearToast} role="presentation">
          <div
            className={`pp-toast pp-${toast.kind}`}
            role="status"
            aria-live="polite"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="pp-toast-title">{toast.title}</div>
            {toast.body && <div className="pp-toast-body">{toast.body}</div>}
          </div>
        </div>
      )}
    </>
  );
}