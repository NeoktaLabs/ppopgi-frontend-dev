// src/components/RaffleDetailsModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { useRaffleDetails } from "../hooks/useRaffleDetails";

import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";

import { ADDRESSES } from "../config/contracts";
import "./raffleCard.css" // reuse pp-rc-titleClamp + pp-rc-pulse

type Props = {
  open: boolean;
  raffleId: string | null;
  onClose: () => void;
};

const ZERO = "0x0000000000000000000000000000000000000000";

function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function isZeroAddr(a?: string | null) {
  if (!a) return true;
  return a.toLowerCase() === ZERO;
}

function toInt(v: string, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// ✅ take leading integer only (prevents "1.5" => 15, "1,5" => 15)
function cleanIntInput(v: string) {
  const m = v.match(/^\s*(\d+)/);
  return m ? m[1] : "";
}

function formatEndsIn(deadlineSeconds: string, nowMs: number) {
  const n = Number(deadlineSeconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown";

  const deadlineMs = n * 1000;
  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) return "Ended";

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad2 = (x: number) => String(x).padStart(2, "0");
  const d = days > 0 ? `${days}d ` : "";
  return `${d}${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}

function formatWhen(tsSeconds: string | null | undefined) {
  const n = Number(tsSeconds || "0");
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  try {
    return new Date(n * 1000).toLocaleString();
  } catch {
    return "Unknown time";
  }
}

function normalizeCancelReason(reason?: string | null) {
  const r = (reason || "").trim().toLowerCase();
  if (r.includes("min") && r.includes("ticket")) return "Min tickets sold not reached";
  if (r.includes("minimum") && r.includes("ticket")) return "Min tickets sold not reached";
  if (r.includes("not enough") && r.includes("ticket")) return "Min tickets sold not reached";
  return reason?.trim() ? reason.trim() : "Canceled";
}

type DisplayStatus =
  | "Open"
  | "Finalizing"
  | "Drawing"
  | "Settled"
  | "Canceled"
  | "Getting ready"
  | "Unknown";

function baseStatusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

function statusTheme(s: DisplayStatus) {
  if (s === "Open")
    return { bg: "rgba(145, 247, 184, 0.92)", fg: "#0B4A24", border: "1px solid rgba(0,0,0,0.06)" };

  if (s === "Finalizing")
    return {
      bg: "rgba(169, 212, 255, 0.95)",
      fg: "#0B2E5C",
      border: "1px solid rgba(0,0,0,0.10)",
      pulse: true,
    };

  if (s === "Drawing")
    return {
      bg: "rgba(169, 212, 255, 0.95)",
      fg: "#0B2E5C",
      border: "1px solid rgba(0,0,0,0.10)",
      pulse: true,
    };

  if (s === "Settled")
    return { bg: "rgba(255, 216, 154, 0.92)", fg: "#4A2A00", border: "1px solid rgba(0,0,0,0.08)" };

  if (s === "Canceled")
    return {
      bg: "rgba(255, 120, 140, 0.92)",
      fg: "#5A0012",
      border: "1px solid rgba(0,0,0,0.10)",
    };

  if (s === "Getting ready")
    return { bg: "rgba(203, 183, 246, 0.92)", fg: "#2E1C5C", border: "1px solid rgba(0,0,0,0.08)" };

  return { bg: "rgba(255,255,255,0.72)", fg: "#5C2A3E", border: "1px solid rgba(0,0,0,0.08)" };
}

// ✅ reason helper: what to show when buying is disabled
function joinBlockedReason(
  data: any | null,
  deadlinePassed: boolean,
  displayStatus: DisplayStatus,
  raffleNotJoinableReason: string | null
) {
  if (!data) return "Loading raffle…";

  // Prefer your existing computed message if present
  if (raffleNotJoinableReason) return raffleNotJoinableReason;

  // Fallbacks (should rarely hit)
  if (data.paused) return "This raffle is paused right now.";
  if (data.status === "FUNDING_PENDING") return "This raffle is getting ready. Try again soon.";
  if (data.status === "OPEN" && deadlinePassed) return "Time ended — this raffle is finalizing right now.";
  if (displayStatus === "Canceled") return "This raffle was canceled.";
  if (displayStatus === "Settled") return "This raffle is settled — you can’t buy tickets anymore.";
  if (displayStatus === "Drawing" || displayStatus === "Finalizing") return "Draw in progress — buying is closed.";
  return "This raffle can’t be joined right now.";
}

export function RaffleDetailsModal({ open, raffleId, onClose }: Props) {
  const { data, loading, note } = useRaffleDetails(raffleId, open);

  const [nowMs, setNowMs] = useState(() => Date.now());

  // ✅ no nested modal: safety becomes an in-modal panel
  const [safetyOpen, setSafetyOpen] = useState(false);

  // ✅ thirdweb is the source of truth
  const activeAccount = useActiveAccount();
  const isConnected = !!activeAccount?.address;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // --- Buy tickets UI state
  const [tickets, setTickets] = useState("1");
  const [buyMsg, setBuyMsg] = useState<string | null>(null);

  // --- Allowance/balance
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  // --- Copy/share feedback
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const deadlineMs = useMemo(() => {
    const n = Number(data?.deadline || "0");
    return Number.isFinite(n) ? n * 1000 : 0;
  }, [data?.deadline]);

  const deadlinePassed = deadlineMs > 0 ? nowMs >= deadlineMs : false;

  // ✅ V2 min purchase (typed)
  const minBuy = useMemo(() => {
    const v = Number(data?.minPurchaseAmount ?? "1");
    if (!Number.isFinite(v) || v <= 0) return 1;
    return Math.floor(v);
  }, [data?.minPurchaseAmount]);

  // ✅ Same “Finalizing” logic as RaffleCard
  const displayStatus: DisplayStatus = useMemo(() => {
    if (!data) return "Unknown";
    if (data.status === "OPEN" && deadlinePassed) return "Finalizing";
    return baseStatusLabel(data.status) as DisplayStatus;
  }, [data, deadlinePassed]);

  const status = statusTheme(displayStatus);

  // ✅ Only truly joinable when OPEN, not paused, and not past deadline
  const raffleIsOpen = !!data && data.status === "OPEN" && !data.paused && !deadlinePassed;

  const raffleNotJoinableReason = useMemo(() => {
    if (!data) return null;
    if (data.paused) return "This raffle is paused right now.";
    if (deadlinePassed && data.status === "OPEN") return "This raffle is finalizing right now.";
    if (data.status !== "OPEN") return `This raffle is ${baseStatusLabel(data.status)} right now.`;
    return null;
  }, [data, deadlinePassed]);

  // ✅ clean share/copy URL: ONLY ?raffle=0x...
  const shareUrl = useMemo(() => {
    if (!raffleId) return null;
    const u = new URL(window.location.href);
    u.search = `?raffle=${raffleId}`;
    return u.toString();
  }, [raffleId]);

  async function onCopyLink() {
    if (!shareUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl, title: data?.name || "Raffle", text: "Join this raffle" });
        setCopyMsg("Shared!");
        window.setTimeout(() => setCopyMsg(null), 1200);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setCopyMsg("Link copied — share it with your friends!");
      window.setTimeout(() => setCopyMsg(null), 1400);
    } catch {
      window.prompt("Copy this link:", shareUrl);
      setCopyMsg("Copy the link");
      window.setTimeout(() => setCopyMsg(null), 1400);
    }
  }

  // Contracts (thirdweb)
  const raffleContract = useMemo(() => {
    if (!raffleId) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: raffleId,
    });
  }, [raffleId]);

  const usdcContract = useMemo(() => {
    const addr = data?.usdcToken || ADDRESSES.USDC;
    if (!addr) return null;

    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: addr,
    });
  }, [data?.usdcToken]);

  // ---------- ticket input bounds (UX-safe) ----------
  const soldNow = data ? Number(data.sold || "0") : 0;
  const maxTicketsN = data ? Number(data.maxTickets || "0") : 0;

  // if maxTickets == "0" we treat as unlimited; still keep a UX cap
  const hardCap = 500;
  const remaining = data && maxTicketsN > 0 ? Math.max(0, maxTicketsN - soldNow) : hardCap;

  const maxBuy = Math.max(minBuy, remaining);
  const ticketCount = clampInt(toInt(tickets, minBuy), minBuy, maxBuy);

  const ticketPriceU = data ? BigInt(data.ticketPrice) : 0n;
  const totalCostU = BigInt(ticketCount) * ticketPriceU;

  function setTicketsSafe(next: number) {
    setTickets(String(clampInt(next, minBuy, maxBuy)));
  }

  // Reset ticket input + messages when opening a new raffle
  useEffect(() => {
    if (!open) return;
    setTickets(String(minBuy));
    setBuyMsg(null);
    setCopyMsg(null);
    setSafetyOpen(false);
  }, [open, raffleId, minBuy]);

  async function refreshAllowance() {
    if (!open) return;
    if (!activeAccount?.address) return;
    if (!usdcContract) return;
    if (!raffleId) return;

    setAllowLoading(true);
    try {
      const [bal, a] = await Promise.all([
        readContract({
          contract: usdcContract,
          method: "function balanceOf(address) view returns (uint256)",
          params: [activeAccount.address],
        }),
        readContract({
          contract: usdcContract,
          method: "function allowance(address,address) view returns (uint256)",
          params: [activeAccount.address, raffleId],
        }),
      ]);

      setUsdcBal(BigInt(bal as any));
      setAllowance(BigInt(a as any));
    } catch {
      setUsdcBal(null);
      setAllowance(null);
    } finally {
      setAllowLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (!activeAccount?.address) return;
    refreshAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeAccount?.address, raffleId, data?.usdcToken]);

  const hasEnoughAllowance = allowance !== null ? allowance >= totalCostU : false;
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= totalCostU : true;

  const canBuy =
    isConnected &&
    raffleIsOpen &&
    !!data &&
    !!raffleContract &&
    ticketCount >= minBuy &&
    totalCostU > 0n &&
    hasEnoughAllowance &&
    hasEnoughBalance &&
    !isPending;

  const needsAllow =
    isConnected &&
    raffleIsOpen &&
    !!data &&
    !!usdcContract &&
    ticketCount >= minBuy &&
    totalCostU > 0n &&
    !hasEnoughAllowance &&
    !isPending;

  async function onAllow() {
    setBuyMsg(null);

    if (!activeAccount?.address) {
      setBuyMsg("Please sign in first.");
      return;
    }
    if (!data || !raffleId || !usdcContract) {
      setBuyMsg("Could not prepare this step. Please try again.");
      return;
    }
    if (!raffleIsOpen) {
      setBuyMsg(raffleNotJoinableReason ?? "This raffle cannot be joined right now.");
      return;
    }
    if (totalCostU <= 0n) {
      setBuyMsg("Choose how many tickets you want first.");
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender,uint256 amount) returns (bool)",
        params: [raffleId, totalCostU],
      });

      await sendAndConfirm(tx);
      setBuyMsg("Coins allowed. You can now buy tickets.");
      await refreshAllowance();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) setBuyMsg("Action canceled.");
      else setBuyMsg("Could not allow coins right now. Please try again.");
    }
  }

  async function onBuy() {
    setBuyMsg(null);

    if (!activeAccount?.address) {
      setBuyMsg("Please sign in first.");
      return;
    }
    if (!data || !raffleContract) {
      setBuyMsg("Could not prepare this purchase. Please try again.");
      return;
    }
    if (!raffleIsOpen) {
      setBuyMsg(raffleNotJoinableReason ?? "This raffle cannot be joined right now.");
      return;
    }
    if (ticketCount < minBuy) {
      setBuyMsg(`Choose at least ${minBuy} ticket${minBuy === 1 ? "" : "s"}.`);
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: raffleContract,
        method: "function buyTickets(uint256 count)",
        params: [BigInt(ticketCount)],
      });

      await sendAndConfirm(tx);

      setBuyMsg("You’re in. Tickets purchased.");
      await refreshAllowance();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) {
        setBuyMsg("Purchase canceled.");
      } else if (m.toLowerCase().includes("insufficient")) {
        setBuyMsg("Not enough coins (USDC) to complete this.");
      } else {
        setBuyMsg("Could not buy tickets. Please try again.");
      }
    }
  }

  // ───────────────── RaffleCard-style visuals ─────────────────

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  const ink = "#5C1F3B";
  const inkStrong = "#4A0F2B";

  const card: React.CSSProperties = {
    position: "relative",
    width: "min(780px, 100%)",
    maxHeight: "min(86vh, 920px)",
    overflow: "auto",
    borderRadius: 22,
    padding: 18,
    userSelect: "none",
    background:
      "linear-gradient(180deg, rgba(255,190,215,0.92), rgba(255,210,230,0.78) 42%, rgba(255,235,246,0.82))",
    border: "1px solid rgba(255,255,255,0.78)",
    boxShadow: "0 22px 46px rgba(0,0,0,0.18)",
    backdropFilter: "blur(14px)",
  };

  const notch: React.CSSProperties = {
    position: "absolute",
    top: "52%",
    transform: "translateY(-50%)",
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "rgba(255,255,255,0.62)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.14)",
    pointerEvents: "none",
  };

  const tearLine: React.CSSProperties = {
    marginTop: 14,
    height: 1,
    background:
      "repeating-linear-gradient(90deg, rgba(180,70,120,0.62), rgba(180,70,120,0.62) 7px," +
      " rgba(0,0,0,0) 7px, rgba(0,0,0,0) 14px)",
    opacity: 0.8,
    pointerEvents: "none",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  };

  const statusChip: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.35,
    whiteSpace: "nowrap",
    background: status.bg,
    color: status.fg,
    border: status.border,
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const miniBtn: React.CSSProperties = {
    borderRadius: 12,
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(0,0,0,0.08)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    padding: "8px 10px",
    fontWeight: 950,
    color: inkStrong,
  };

  const miniBtnDisabled: React.CSSProperties = {
    ...miniBtn,
    cursor: "not-allowed",
    opacity: 0.6,
  };

  const copyToast: React.CSSProperties = {
    position: "absolute",
    top: 54,
    left: 12,
    right: 12,
    padding: "8px 10px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.90)",
    border: "1px solid rgba(0,0,0,0.08)",
    color: inkStrong,
    fontSize: 12,
    fontWeight: 950,
    textAlign: "center",
    boxShadow: "0 14px 26px rgba(0,0,0,0.12)",
    pointerEvents: "none",
  };

  const titleWrap: React.CSSProperties = { marginTop: 8, textAlign: "center" };
  const smallKicker: React.CSSProperties = { fontSize: 12, fontWeight: 800, opacity: 0.9, color: ink };
  const titleText: React.CSSProperties = {
    marginTop: 4,
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: 0.1,
    lineHeight: 1.15,
    color: inkStrong,
  };

  const prizeKicker: React.CSSProperties = {
    marginTop: 14,
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.45,
    textTransform: "uppercase",
    opacity: 0.92,
    color: ink,
    textAlign: "center",
  };

  const prizeValue: React.CSSProperties = {
    marginTop: 8,
    fontSize: 40,
    fontWeight: 1000 as any,
    lineHeight: 1.0,
    letterSpacing: 0.2,
    textAlign: "center",
    color: inkStrong,
    textShadow: "0 1px 0 rgba(255,255,255,0.35)",
  };

  const grid2: React.CSSProperties = {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };

  const grid3: React.CSSProperties = {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  };

  const mini: React.CSSProperties = {
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
  };

  const miniLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.25,
    opacity: 0.9,
    color: ink,
  };

  const miniValue: React.CSSProperties = { marginTop: 6, fontSize: 14, fontWeight: 950, color: inkStrong };
  const hint: React.CSSProperties = { marginTop: 4, fontSize: 11, fontWeight: 800, opacity: 0.88, color: ink };

  const section: React.CSSProperties = { marginTop: 12 };

  const panel: React.CSSProperties = {
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
    display: "grid",
    gap: 8,
  };

  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 };

  const label: React.CSSProperties = { opacity: 0.85, color: ink };
  const value: React.CSSProperties = { fontWeight: 950, color: inkStrong };

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 14,
    padding: "10px 10px",
    outline: "none",
    color: inkStrong,
    fontWeight: 900,
  };

  const btn: React.CSSProperties = {
    width: "100%",
    marginTop: 10,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 14,
    padding: "12px 12px",
    color: inkStrong,
    fontWeight: 1000,
    textAlign: "center",
  };

  const btnDisabled: React.CSSProperties = { ...btn, cursor: "not-allowed", opacity: 0.6 };
  const btnEnabled: React.CSSProperties = { ...btn, cursor: "pointer", opacity: 1 };

  const bottomRow: React.CSSProperties = {
    marginTop: 12,
    paddingTop: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  };

  const bottomText: React.CSSProperties = { fontSize: 14, fontWeight: 950, color: inkStrong, letterSpacing: 0.2 };

  const pulseBottom = displayStatus === "Finalizing" || displayStatus === "Drawing";

  // ✅ Match RaffleCard’s “past block” behavior using subgraph history
  const pastHeadline = useMemo(() => {
    const h = data?.history;
    if (!data) return null;

    if (displayStatus === "Settled") {
      const when = h?.completedAt ?? h?.finalizedAt ?? null;
      return `Settled at ${formatWhen(when)}`;
    }
    if (displayStatus === "Canceled") {
      return `Canceled at ${formatWhen(h?.canceledAt ?? null)}`;
    }
    if (displayStatus === "Drawing" || displayStatus === "Finalizing") return "Draw in progress";
    return null;
  }, [data, displayStatus]);

  const pastSubline = useMemo(() => {
    const h = data?.history;
    if (!data) return null;

    if (displayStatus === "Settled") return data.winner && !isZeroAddr(data.winner) ? "Someone won!" : "Settled";
    if (displayStatus === "Canceled") return normalizeCancelReason(h?.canceledReason ?? null);
    if (displayStatus === "Drawing" || displayStatus === "Finalizing") return "Waiting for the result";
    return null;
  }, [data, displayStatus]);

  const bottomLine = useMemo(() => {
    if (displayStatus === "Open" || displayStatus === "Getting ready") return formatEndsIn(data?.deadline || "0", nowMs);
    if (displayStatus === "Finalizing" || displayStatus === "Drawing") return "Draw in progress";
    if (displayStatus === "Settled") return "Settled";
    if (displayStatus === "Canceled") return "Canceled";
    return "Unknown";
  }, [displayStatus, data?.deadline, nowMs]);

  const canShowWinner = data?.status === "COMPLETED";

  // ✅ IMPORTANT: only return null AFTER all hooks have run (prevents hook order crash)
  if (!open) return null;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Ticket notches */}
        <div style={{ ...notch, left: -9 }} />
        <div style={{ ...notch, right: -9 }} />

        <div style={topRow}>
          <div style={statusChip} className={status.pulse ? "pp-rc-pulse" : undefined}>
            {displayStatus.toUpperCase()}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={onCopyLink} disabled={!shareUrl} style={shareUrl ? miniBtn : miniBtnDisabled} title="Copy link">
              Copy link
            </button>

            <button
              onClick={() => setSafetyOpen((v) => !v)}
              disabled={!data}
              style={data ? miniBtn : miniBtnDisabled}
              title="Safety info"
              aria-expanded={safetyOpen}
            >
              🛡️ Safety
            </button>

            <button onClick={onClose} style={miniBtn} title="Close">
              Close
            </button>
          </div>
        </div>

        {copyMsg && <div style={copyToast}>{copyMsg}</div>}

        <div style={titleWrap}>
          <div style={smallKicker}>Ppopgi</div>
          <div style={titleText} className="pp-rc-titleClamp" title={data?.name || ""}>
            {data?.name ?? "Loading…"}
          </div>
          {raffleId ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, color: ink }}>{raffleId}</div> : null}

          {/* ✅ card-like “past block” right under title when not open-ish */}
          {data && displayStatus !== "Open" && displayStatus !== "Getting ready" && (
            <div
              style={{
                marginTop: 10,
                borderRadius: 14,
                padding: 12,
                background: "rgba(255,255,255,0.56)",
                border: "1px solid rgba(0,0,0,0.06)",
                display: "grid",
                gap: 6,
                textAlign: "left",
              }}
            >
              <div
                style={{ fontSize: 12, fontWeight: 950, color: inkStrong, lineHeight: 1.25 }}
                className={pulseBottom ? "pp-rc-pulse" : undefined}
              >
                {pastHeadline ?? bottomLine}
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: ink, opacity: 0.92, lineHeight: 1.25 }}>
                {pastSubline ?? ""}
              </div>
            </div>
          )}
        </div>

        <div style={prizeKicker}>Winner gets</div>
        <div style={prizeValue}>{fmtUsdc(data?.winningPot || "0")} USDC</div>

        <div style={tearLine} />

        {/* Top stats */}
        <div style={grid2}>
          <div style={mini}>
            <div style={miniLabel}>Ticket price</div>
            <div style={miniValue}>{fmtUsdc(data?.ticketPrice || "0")} USDC</div>
            <div style={hint}>Min buy: {minBuy}</div>
          </div>

          <div style={mini}>
            <div style={miniLabel}>Tickets sold</div>
            <div style={miniValue}>
              {data?.sold ?? "0"}
              {data?.maxTickets && data.maxTickets !== "0" ? ` / ${data.maxTickets}` : ""}
            </div>
            <div style={hint}>{data?.maxTickets && data.maxTickets !== "0" ? `Max: ${data.maxTickets}` : "No max limit"}</div>
          </div>
        </div>

        {/* Extra tiles */}
        <div style={grid3}>
          <div style={mini}>
            <div style={miniLabel}>Revenue</div>
            <div style={miniValue}>{fmtUsdc(data?.ticketRevenue || "0")} USDC</div>
            <div style={hint}>From tickets sold</div>
          </div>

          <div style={mini}>
            <div style={miniLabel}>Fee</div>
            <div style={miniValue}>{data?.protocolFeePercent ?? "0"}%</div>
            <div style={hint}>Receiver: {short(data?.feeRecipient || "")}</div>
          </div>

          <div style={mini}>
  <div style={miniLabel}>Ends</div>
  <div style={miniValue}>
    {displayStatus === "Canceled"
      ? "Canceled"
      : displayStatus === "Settled"
      ? "Settled"
      : displayStatus === "Drawing" || displayStatus === "Finalizing"
      ? "Finalizing"
      : deadlinePassed
      ? "Ended"
      : "Active"}
  </div>
  <div style={hint}>{formatWhen(data?.deadline)}</div>
</div>
        </div>

        {/* Optional creation metadata (subgraph) */}
        {data?.history?.createdAtTimestamp && (
          <div style={section}>
            <div style={panel}>
              <div style={{ fontWeight: 1000, color: inkStrong }}>Details</div>
              <div style={row}>
                <div style={label}>Created</div>
                <div style={value}>{formatWhen(data.history.createdAtTimestamp)}</div>
              </div>
              {data.history.creationTx ? (
                <div style={row}>
                  <div style={label}>Creation tx</div>
                  <div style={value}>{short(data.history.creationTx)}</div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Loading + note */}
        {loading && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85, color: inkStrong }}>Loading live details…</div>}
        {note && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, color: inkStrong }}>{note}</div>}

        {/* Safety panel */}
        {data && safetyOpen && (
          <div style={section}>
            <div style={panel} role="region" aria-label="Safety info">
              <div style={{ fontWeight: 1000, color: inkStrong }}>Safety info</div>

              <div style={row}>
                <div style={label}>USDC token</div>
                <div style={value}>{short(data.usdcToken || ADDRESSES.USDC)}</div>
              </div>

              <div style={row}>
                <div style={label}>Fee receiver</div>
                <div style={value}>{short(data.feeRecipient)}</div>
              </div>

              <div style={row}>
                <div style={label}>Entropy</div>
                <div style={value}>{isZeroAddr(data.entropy) ? "—" : short(data.entropy)}</div>
              </div>

              <div style={row}>
                <div style={label}>Entropy provider</div>
                <div style={value}>{isZeroAddr(data.entropyProvider) ? "—" : short(data.entropyProvider)}</div>
              </div>

              <div style={row}>
                <div style={label}>Callback gas</div>
                <div style={value}>{data.callbackGasLimit}</div>
              </div>

              <div style={row}>
                <div style={label}>Finalize request</div>
                <div style={value}>{data.finalizeRequestId}</div>
              </div>

              <div style={row}>
                <div style={label}>Entropy request</div>
                <div style={value}>{data.entropyRequestId}</div>
              </div>

              <div style={row}>
                <div style={label}>Selected provider</div>
                <div style={value}>{isZeroAddr(data.selectedProvider) ? "—" : short(data.selectedProvider)}</div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.9, color: ink, lineHeight: 1.35 }}>
                The app only reads contract state and prepares transactions for you to confirm. If something is not
                claimable/withdrawable, it will fail on-chain.
              </div>
            </div>
          </div>
        )}

        {/* ✅ Join panel (hide buy UI when not joinable) */}
        <div style={section}>
          <div style={panel}>
            <div style={{ fontWeight: 1000, color: inkStrong }}>{raffleIsOpen ? "Join" : "Join unavailable"}</div>

            {!raffleIsOpen ? (
              <>
                <div style={{ fontSize: 13, opacity: 0.92, color: inkStrong }}>
                  {joinBlockedReason(data, deadlinePassed, displayStatus, raffleNotJoinableReason)}
                </div>

                <div style={{ fontSize: 12, opacity: 0.85, color: ink, lineHeight: 1.35 }}>
                  {displayStatus === "Finalizing" || displayStatus === "Drawing"
                    ? "Once the draw completes, the Winner section will update here."
                    : displayStatus === "Settled"
                    ? "Check the Winner section below."
                    : displayStatus === "Canceled"
                    ? "If you’re owed a refund, it will become claimable on-chain."
                    : ""}
                </div>
              </>
            ) : (
              <>
                <div style={row}>
                  <div style={label}>Total cost</div>
                  <div style={value}>{fmtUsdc(totalCostU.toString())} USDC</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", gap: 10 }}>
                  <button
                    style={ticketCount > minBuy ? btnEnabled : btnDisabled}
                    disabled={ticketCount <= minBuy}
                    onClick={() => setTicketsSafe(ticketCount - 1)}
                    type="button"
                  >
                    −
                  </button>

                  <input
                    style={input}
                    value={tickets}
                    onChange={(e) => setTickets(cleanIntInput(e.target.value))}
                    onBlur={() => setTicketsSafe(toInt(tickets, minBuy))}
                    placeholder={String(minBuy)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />

                  <button
                    style={ticketCount < maxBuy ? btnEnabled : btnDisabled}
                    disabled={ticketCount >= maxBuy}
                    onClick={() => setTicketsSafe(ticketCount + 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>

                <div style={{ fontSize: 12, opacity: 0.9, color: ink }}>
                  Min: {minBuy} • Max: {maxBuy}
                </div>

                {isConnected ? (
                  <div style={{ fontSize: 12, opacity: 0.85, color: ink }}>
                    {allowLoading ? (
                      "Checking coins…"
                    ) : (
                      <>
                        {usdcBal !== null ? `Your coins: ${fmtUsdc(usdcBal.toString())} USDC • ` : ""}
                        {allowance !== null ? `Allowed: ${fmtUsdc(allowance.toString())} USDC` : ""}
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.85, color: ink }}>Please sign in to join.</div>
                )}

                <button style={needsAllow ? btnEnabled : btnDisabled} disabled={!needsAllow} onClick={onAllow}>
                  {isPending ? "Confirming…" : isConnected ? "Allow coins (USDC)" : "Sign in to allow"}
                </button>

                <button style={canBuy ? btnEnabled : btnDisabled} disabled={!canBuy} onClick={onBuy}>
                  {isPending ? "Confirming…" : isConnected ? "Buy tickets" : "Sign in to join"}
                </button>

                {!hasEnoughBalance && (
                  <div style={{ fontSize: 13, opacity: 0.95, color: inkStrong }}>Not enough USDC for this purchase.</div>
                )}

                <div style={{ fontSize: 12, opacity: 0.9, color: ink }}>
                  Nothing happens automatically. You always confirm actions yourself.
                </div>

                {buyMsg && <div style={{ fontSize: 13, opacity: 0.95, color: inkStrong }}>{buyMsg}</div>}
              </>
            )}
          </div>
        </div>

        {/* Winner panel */}
        <div style={section}>
          <div style={panel}>
            <div style={{ fontWeight: 1000, color: inkStrong }}>Winner</div>

            {canShowWinner && data?.winner && !isZeroAddr(data.winner) ? (
              <>
                <div style={row}>
                  <div style={label}>Winning account</div>
                  <div style={value}>{short(data.winner)}</div>
                </div>
                <div style={row}>
                  <div style={label}>Winning ticket</div>
                  <div style={value}>{data.winningTicketIndex}</div>
                </div>
                <div style={row}>
                  <div style={label}>Prize</div>
                  <div style={value}>{fmtUsdc(data.winningPot)} USDC</div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.9, color: ink }}>
                The winner is shown only after the raffle is settled.
              </div>
            )}
          </div>
        </div>

        {/* Bottom line like card */}
        <div style={bottomRow}>
          <div style={bottomText}>
            {displayStatus === "Open" || displayStatus === "Getting ready" ? (
              `Ends in ${bottomLine}`
            ) : (
              <span
                className={pulseBottom ? "pp-rc-pulse" : undefined}
                style={pulseBottom ? { color: "#0B2E5C" } : undefined}
              >
                {bottomLine}
              </span>
            )}
          </div>

          {/* sparkle icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2l1.2 4.5L18 8l-4.8 1.5L12 14l-1.2-4.5L6 8l4.8-1.5L12 2Z"
              stroke={inkStrong}
              strokeWidth="2"
              strokeLinejoin="round"
              opacity="0.85"
            />
            <path
              d="M19 13l.7 2.5L22 16l-2.3.5L19 19l-.7-2.5L16 16l2.3-.5L19 13Z"
              stroke={inkStrong}
              strokeWidth="2"
              strokeLinejoin="round"
              opacity="0.75"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}