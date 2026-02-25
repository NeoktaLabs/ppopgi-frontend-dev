// src/hooks/useLotteryDetails.ts

import { useEffect, useMemo, useRef, useState } from "react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { getAddress } from "ethers";

export type LotteryStatus =
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED"
  | "UNKNOWN";

function statusFromUint8(n: number): LotteryStatus {
  if (n === 0) return "FUNDING_PENDING";
  if (n === 1) return "OPEN";
  if (n === 2) return "DRAWING";
  if (n === 3) return "COMPLETED";
  if (n === 4) return "CANCELED";
  return "UNKNOWN";
}

// Your indexer/subgraph stores status as an int; some tooling might return a string.
// Accept both.
function statusFromSubgraph(v: any): LotteryStatus {
  if (typeof v === "number") return statusFromUint8(v);
  const n = Number(v);
  if (Number.isFinite(n)) return statusFromUint8(n);

  const s = String(v || "").toUpperCase().trim();
  if (s === "FUNDING_PENDING") return "FUNDING_PENDING";
  if (s === "OPEN") return "OPEN";
  if (s === "DRAWING") return "DRAWING";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "CANCELED") return "CANCELED";
  return "UNKNOWN";
}

const ZERO = "0x0000000000000000000000000000000000000000";

function normHex(v: unknown): string {
  return String(v || "").toLowerCase();
}

type LotteryHistory = {
  status?: string | number | null;

  // creation-ish
  createdAt?: string | null;
  deployedAt?: string | null;
  deployedTx?: string | null;

  // drawing-ish
  drawingRequestedAt?: string | null;
  soldAtDrawing?: string | null;
  entropyRequestId?: string | null;
  selectedProvider?: string | null;
  winner?: string | null;

  // cancel-ish
  canceledAt?: string | null;
  soldAtCancel?: string | null;
  cancelReason?: string | null;
  creatorPotRefunded?: boolean | null;

  // registry-ish
  registryIndex?: string | null;
  registeredAt?: string | null;
};

export type LotteryDetails = {
  address: string;

  name: string;
  status: LotteryStatus;

  sold: string;
  ticketRevenue: string;

  ticketPrice: string;
  winningPot: string;

  minTickets: string;
  maxTickets: string;
  deadline: string;

  // best-effort legacy
  paused: boolean;

  minPurchaseAmount: string;

  // entropy/draw config
  entropy: string;
  entropyProvider: string;
  entropyRequestId: string;
  selectedProvider: string;
  callbackGasLimit: string;

  // token/creator config
  usdcToken: string;
  creator: string;

  // fee config
  feeRecipient: string;
  protocolFeePercent: string;

  // outcome
  winner: string;
  winningTicketIndex: string;

  history?: LotteryHistory;
};

async function readFirst(
  contract: any,
  label: string,
  candidates: string[],
  params: readonly unknown[] = []
): Promise<any> {
  let lastErr: any = null;
  for (const method of candidates) {
    try {
      return await readContract({ contract, method, params });
    } catch (e) {
      lastErr = e;
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[useLotteryDetails] Failed to read ${label}. Tried:`, candidates, lastErr);
  throw lastErr;
}

async function readFirstOr(
  contract: any,
  label: string,
  candidates: string[],
  fallback: any,
  params: readonly unknown[] = []
): Promise<any> {
  try {
    return await readFirst(contract, label, candidates, params);
  } catch {
    return fallback;
  }
}

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: any;
  try {
    return await Promise.race([
      p,
      new Promise<T>((res) => {
        t = setTimeout(() => res(fallback), ms);
      }),
    ]);
  } finally {
    clearTimeout(t);
  }
}

async function fetchLotteryHistoryFromSubgraph(
  id: string,
  signal?: AbortSignal
): Promise<LotteryHistory | null> {
  const lotteryId = id.toLowerCase();
  const url = mustEnv("VITE_SUBGRAPH_URL");

  const query = `
    query LotteryById($id: Bytes!) {
      lottery(id: $id) {
        status

        createdAt
        deployedAt
        deployedTx

        drawingRequestedAt
        soldAtDrawing
        entropyRequestId
        selectedProvider
        winner

        canceledAt
        soldAtCancel
        cancelReason
        creatorPotRefunded

        registryIndex
        registeredAt
      }
    }
  `;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { id: lotteryId } }),
    signal,
  });

  if (!res.ok) throw new Error(`SUBGRAPH_HTTP_ERROR_${res.status}`);

  const json = await res.json().catch(() => null);
  if (json?.errors?.length) throw new Error("SUBGRAPH_GQL_ERROR");

  const r = json?.data?.lottery;
  if (!r) return null;

  return {
    status: r.status ?? null,

    createdAt: r.createdAt ?? null,
    deployedAt: r.deployedAt ?? null,
    deployedTx: r.deployedTx != null ? normHex(r.deployedTx) : null,

    drawingRequestedAt: r.drawingRequestedAt ?? null,
    soldAtDrawing: r.soldAtDrawing ?? null,
    entropyRequestId: r.entropyRequestId ?? null,
    selectedProvider: r.selectedProvider != null ? normHex(r.selectedProvider) : null,
    winner: r.winner != null ? normHex(r.winner) : null,

    canceledAt: r.canceledAt ?? null,
    soldAtCancel: r.soldAtCancel ?? null,
    cancelReason: r.cancelReason ?? null,
    creatorPotRefunded: typeof r.creatorPotRefunded === "boolean" ? r.creatorPotRefunded : null,

    registryIndex: r.registryIndex ?? null,
    registeredAt: r.registeredAt ?? null,
  };
}

/**
 * On-chain trust philosophy:
 * - Fetch "live" fields from RPC that can change quickly or matter for actions:
 *   status, sold, winner(+ticket index if completed)
 * - Everything else comes from subgraph history (fast + cached), and is displayed as such.
 *
 * This keeps RPC calls minimal and avoids hammering.
 */

// Very small in-memory TTL cache to avoid refetch when user opens/closes the modal quickly
type CacheEntry = { ts: number; data: LotteryDetails };
const DETAILS_CACHE_TTL_MS = 7_500;
const detailsCache = new Map<string, CacheEntry>();

export function useLotteryDetails(lotteryAddress: string | null, open: boolean) {
  const [data, setData] = useState<LotteryDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // used to ignore stale async results
  const runIdRef = useRef(0);

  const normalizedAddress = useMemo(() => {
    if (!lotteryAddress) return null;
    try {
      return getAddress(lotteryAddress);
    } catch {
      return lotteryAddress;
    }
  }, [lotteryAddress]);

  const contract = useMemo(() => {
    if (!normalizedAddress) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: normalizedAddress,
    });
  }, [normalizedAddress]);

  useEffect(() => {
    if (!open || !contract || !normalizedAddress) return;

    // Serve hot cache immediately (no RPC)
    const cacheKey = normalizedAddress.toLowerCase();
    const cached = detailsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < DETAILS_CACHE_TTL_MS) {
      setData(cached.data);
      setLoading(false);
      setNote(null);
      return;
    }

    const runId = ++runIdRef.current;

    let alive = true;
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setNote(null);

      // Always try to get subgraph "bulk" fields quickly, but never block RPC truth.
      const historyPromise = withTimeout(
        fetchLotteryHistoryFromSubgraph(normalizedAddress, ac.signal).catch(() => null),
        2500,
        null
      );

      try {
        // ----------------------------
        // ✅ Minimal on-chain reads
        // ----------------------------
        // Do these in parallel (important).
        const [statusU8, sold, winner] = await Promise.all([
          readFirstOr(contract, "status", ["function status() view returns (uint8)"], 255),
          readFirstOr(
            contract,
            "sold",
            ["function getSold() view returns (uint256)", "function sold() view returns (uint256)"],
            0n
          ),
          readFirstOr(contract, "winner", ["function winner() view returns (address)"], ZERO),
        ]);

        const onchainStatus = statusFromUint8(Number(statusU8));

        const winningTicketIndex =
          onchainStatus === "COMPLETED"
            ? await readFirstOr(contract, "winningTicketIndex", ["function winningTicketIndex() view returns (uint256)"], 0n)
            : 0n;

        if (!alive || runId !== runIdRef.current) return;

        // ----------------------------
        // ✅ Subgraph bulk fields
        // ----------------------------
        const history = await historyPromise;

        // Build display values primarily from subgraph if available.
        // If subgraph is missing, we degrade gracefully to placeholders.
        const name = history ? undefined : undefined; // we intentionally do NOT read name on-chain anymore
        const subgraphStatus = history ? statusFromSubgraph(history.status) : "UNKNOWN";

        const finalStatus: LotteryStatus =
          subgraphStatus === "CANCELED" || subgraphStatus === "COMPLETED" || subgraphStatus === "DRAWING"
            ? subgraphStatus
            : onchainStatus;

        // NOTE:
        // All these "static-ish" fields are expected to be present in your Lottery entity.
        // If history is null, we fill with safe placeholders and show a note.
        const d: LotteryDetails = {
          address: normalizedAddress,

          // Name: prefer subgraph (it’s in Lottery entity); if history fetch didn’t include it, keep generic.
          // If you want name always, add it to the history query (cheap) rather than RPC.
          name: "Lottery",

          status: finalStatus,

          // On-chain truth:
          sold: String(sold),

          // From subgraph (if available). If missing, show 0 and warn.
          ticketRevenue: history ? "0" : "0",

          ticketPrice: history ? "0" : "0",
          winningPot: history ? "0" : "0",

          minTickets: history ? "0" : "0",
          maxTickets: history ? "0" : "0",
          deadline: history?.deployedAt ? String(history.deployedAt) : history?.registeredAt ? String(history.registeredAt) : "0",

          // legacy best-effort (we no longer read it on-chain)
          paused: false,

          minPurchaseAmount: history ? "0" : "0",

          entropy: history ? "0x" : ZERO,
          entropyProvider: history ? "0x" : ZERO,
          entropyRequestId: history?.entropyRequestId != null ? String(history.entropyRequestId) : "0",
          selectedProvider: history?.selectedProvider != null ? String(history.selectedProvider) : ZERO,
          callbackGasLimit: history ? "0" : "0",

          usdcToken: history ? "0x" : ZERO,
          creator: "0x",

          feeRecipient: history ? "0x" : ZERO,
          protocolFeePercent: history ? "0" : "0",

          // On-chain truth:
          winner: String(winner),
          winningTicketIndex: String(winningTicketIndex),

          history: history ?? undefined,
        };

        // If we got history, merge in the actual Lottery entity fields you already store
        // (ticketPrice, winningPot, etc.) by fetching a richer object.
        //
        // Instead of expanding this hook with another query, the simplest move is:
        // - keep history query light (as you have)
        // - but ALSO query the Lottery core fields once from subgraph here
        //   (still 1 request, far cheaper than 15+ RPC calls).
        //
        // We'll do that by reusing the same endpoint, but keeping it optional and fast.
        // (If you prefer, I can switch it to import fetchLotteryById from indexer/subgraph.ts.)
        const url = mustEnv("VITE_SUBGRAPH_URL");
        const detailsQuery = `
          query LotteryCore($id: Bytes!) {
            lottery(id: $id) {
              id
              name
              creator
              usdcToken
              feeRecipient
              protocolFeePercent
              entropy
              entropyProvider
              callbackGasLimit
              minPurchaseAmount
              ticketPrice
              winningPot
              minTickets
              maxTickets
              deadline
              ticketRevenue
              status
            }
          }
        `;

        const core = await withTimeout(
          fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: detailsQuery, variables: { id: cacheKey } }),
            signal: ac.signal,
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => (j?.data?.lottery ? j.data.lottery : null))
            .catch(() => null),
          2500,
          null
        );

        if (!alive || runId !== runIdRef.current) return;

        if (core) {
          const merged: LotteryDetails = {
            ...d,
            name: String(core.name ?? d.name),
            creator: String(core.creator ?? d.creator),
            usdcToken: String(core.usdcToken ?? d.usdcToken),
            feeRecipient: String(core.feeRecipient ?? d.feeRecipient),
            protocolFeePercent: String(core.protocolFeePercent ?? d.protocolFeePercent),

            entropy: String(core.entropy ?? d.entropy),
            entropyProvider: String(core.entropyProvider ?? d.entropyProvider),
            callbackGasLimit: String(core.callbackGasLimit ?? d.callbackGasLimit),
            minPurchaseAmount: String(core.minPurchaseAmount ?? d.minPurchaseAmount),

            ticketPrice: String(core.ticketPrice ?? d.ticketPrice),
            winningPot: String(core.winningPot ?? d.winningPot),
            minTickets: String(core.minTickets ?? d.minTickets),
            maxTickets: String(core.maxTickets ?? d.maxTickets),
            deadline: String(core.deadline ?? d.deadline),
            ticketRevenue: String(core.ticketRevenue ?? d.ticketRevenue),

            // keep on-chain overrides for fields we trust from RPC:
            status: finalStatus,
            sold: String(sold),
            winner: String(winner),
            winningTicketIndex: String(winningTicketIndex),
          };

          setData(merged);
          detailsCache.set(cacheKey, { ts: Date.now(), data: merged });
          setNote(null);
          return;
        }

        // If subgraph core not available, show the minimal on-chain view and warn.
        setData(d);
        detailsCache.set(cacheKey, { ts: Date.now(), data: d });
        setNote("Showing minimal on-chain data. Indexer details are still syncing or unavailable.");
      } catch {
        if (!alive || runId !== runIdRef.current) return;
        setData(null);
        setNote("Could not load this lottery right now. Please refresh (and check console logs).");
      } finally {
        if (!alive || runId !== runIdRef.current) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      try {
        ac.abort();
      } catch {}
    };
  }, [open, contract, normalizedAddress]);

  return { data, loading, note };
}