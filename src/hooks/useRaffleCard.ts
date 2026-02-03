// src/hooks/useRaffleCard.ts
import { useState, useMemo } from "react";
import { formatUnits } from "ethers";
import type { RaffleListItem } from "../indexer/subgraph";

// --- Helpers ---
const toNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const fmtUsdc = (raw: string) => { try { return formatUnits(BigInt(raw || "0"), 6); } catch { return "0"; } };

// Status Helper
function getDisplayStatus(status: string, deadline: string, nowMs: number) {
  const deadlineMs = Number(deadline) * 1000;
  const isExpired = deadlineMs > 0 && nowMs >= deadlineMs;

  if (status === "OPEN" && isExpired) return "Finalizing";
  if (status === "FUNDING_PENDING") return "Getting ready";
  if (status === "OPEN") return "Open";
  if (status === "DRAWING") return "Drawing";
  if (status === "COMPLETED") return "Settled";
  if (status === "CANCELED") return "Canceled";
  return "Unknown";
}

// Time Helper
function formatEndsIn(deadline: string, nowMs: number) {
  const diff = (Number(deadline) * 1000) - nowMs;
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

export function useRaffleCard(raffle: RaffleListItem, nowMs: number) {
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // 1. Status & Time
  const displayStatus = useMemo(() => getDisplayStatus(raffle.status, raffle.deadline, nowMs), [raffle.status, raffle.deadline, nowMs]);
  const timeLeft = useMemo(() => formatEndsIn(raffle.deadline, nowMs), [raffle.deadline, nowMs]);
  const isLive = displayStatus === "Open" || displayStatus === "Getting ready";

  // 2. Math (Progress Bars)
  const sold = toNum(raffle.sold);
  const min = toNum((raffle as any).minTickets);
  const max = toNum(raffle.maxTickets !== "0" ? raffle.maxTickets : (raffle as any).maxTickets); // handle legacy 0
  
  const hasMin = min > 0;
  const hasMax = max > 0;
  const minReached = !hasMin || sold >= min;
  
  const progressMin = hasMin ? clamp01(sold / min) : 0;
  const progressMax = hasMax ? clamp01(sold / max) : 0;

  // 3. Actions
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set("raffle", raffle.id);
    const link = url.toString();

    try {
      if (navigator.share) {
        await navigator.share({ url: link, title: raffle.name });
        setCopyMsg("Shared!");
      } else {
        await navigator.clipboard.writeText(link);
        setCopyMsg("Link copied!");
      }
    } catch { setCopyMsg("Failed to share"); }
    setTimeout(() => setCopyMsg(null), 1500);
  };

  return {
    ui: { 
      displayStatus, timeLeft, isLive, copyMsg,
      formattedPot: fmtUsdc(raffle.winningPot),
      formattedPrice: fmtUsdc(raffle.ticketPrice),
      sold, min, max, hasMin, hasMax, minReached,
      progressMinPct: `${Math.round(progressMin * 100)}%`,
      progressMaxPct: `${Math.round(progressMax * 100)}%`
    },
    actions: { handleShare }
  };
}
