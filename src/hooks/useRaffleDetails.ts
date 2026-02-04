// src/hooks/useRaffleDetails.ts
import { useEffect, useMemo, useState } from "react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { getAddress } from "ethers";

export type RaffleStatus =
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED"
  | "UNKNOWN";

function statusFromUint8(n: number): RaffleStatus {
  if (n === 0) return "FUNDING_PENDING";
  if (n === 1) return "OPEN";
  if (n === 2) return "DRAWING";
  if (n === 3) return "COMPLETED";
  if (n === 4) return "CANCELED";
  return "UNKNOWN";
}

function statusFromSubgraph(v: any): RaffleStatus {
  const s = String(v || "").toUpperCase().trim();
  if (s === "FUNDING_PENDING") return "FUNDING_PENDING";
  if (s === "OPEN") return "OPEN";
  if (s === "DRAWING") return "DRAWING";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "CANCELED") return "CANCELED";
  return "UNKNOWN";
}

const ZERO = "0x0000000000000000000000000000000000000000";

// ---- Small cache to reduce indexer/RPC spam on modal open/close ----
type CacheEntry<T> = { ts: number; data: T };
const HISTORY_TTL_MS = 45_000; // 45s: avoids rate limits, still feels “live”
const DETAILS_TTL_MS = 10_000; // 10s: avoids hammering RPC on quick reopen

const historyCache = new Map<string, CacheEntry<RaffleHistory | null>>();
const detailsCache = new Map<string, CacheEntry<RaffleDetails | null>>();

type RaffleHistory = {
  status?: string | null;

  createdAtTimestamp?: string | null;
  creationTx?: string | null;

  finalizedAt?: string | null;
  completedAt?: string | null;

  canceledAt?: string | null;
  canceledReason?: string | null;
  soldAtCancel?: string | null;

  lastUpdatedTimestamp?: string | null;

  registry?: string | null;
  registryIndex?: string | null;
  isRegistered?: boolean | null;
  registeredAt?: string | null;
};

export type RaffleDetails = {
  address: string;

  name: string;
  status: RaffleStatus;

  sold: string;
  ticketRevenue: string;

  ticketPrice: string;
  winningPot: string;

  minTickets: string;
  maxTickets: string;
  deadline: string;
  paused: boolean;

  minPurchaseAmount: string;

  finalizeRequestId: string;
  callbackGasLimit: string;

  usdcToken: string;
  creator: string;

  winner: string;
  winningTicketIndex: string;

  feeRecipient: string;
  protocolFeePercent: string;

  entropy: string;
  entropyProvider: string;
  entropyRequestId: string;
  selectedProvider: string;

  history?: RaffleHistory;
};

async function readFirst(contract: any, label: string, candidates: string[], params: readonly unknown[] = []) {
  let lastErr: any = null;
  for (const method of candidates) {
    try {
      return await readContract({ contract, method, params });
    } catch (e) {
      lastErr = e;
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[useRaffleDetails] Failed to read ${label}. Tried:`, candidates, lastErr);
  throw lastErr;
}

async function readFirstOr(
  contract: any,
  label: string,
  candidates: string[],
  fallback: any,
  params: readonly unknown[] = []
) {
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

async function fetchRaffleHistoryFromSubgraph(id: string, signal?: AbortSignal): Promise<RaffleHistory | null> {
  const raffleId = id.toLowerCase();
  const url = mustEnv("VITE_SUBGRAPH_URL");

  const query = `
    query RaffleById($id: ID!) {
      raffle(id: $id) {
        status
        createdAtTimestamp
        creationTx
        finalizedAt
        completedAt
        canceledAt
        canceledReason
        soldAtCancel
        lastUpdatedTimestamp
        registry
        registryIndex
        isRegistered
        registeredAt
      }
    }
  `;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { id: raffleId } }),
    signal,
  });

  if (!res.ok) throw new Error("SUBGRAPH_HTTP_ERROR");
  const json = await res.json();
  if (json?.errors?.length) throw new Error("SUBGRAPH_GQL_ERROR");

  const r = json.data?.raffle;
  if (!r) return null;

  return {
    status: r.status ?? null,
    createdAtTimestamp: r.createdAtTimestamp ?? null,
    creationTx: r.creationTx ?? null,
    finalizedAt: r.finalizedAt ?? null,
    completedAt: r.completedAt ?? null,
    canceledAt: r.canceledAt ?? null,
    canceledReason: r.canceledReason ?? null,
    soldAtCancel: r.soldAtCancel ?? null,
    lastUpdatedTimestamp: r.lastUpdatedTimestamp ?? null,
    registry: r.registry ?? null,
    registryIndex: r.registryIndex ?? null,
    isRegistered: typeof r.isRegistered === "boolean" ? r.isRegistered : null,
    registeredAt: r.registeredAt ?? null,
  };
}

function getCached<T>(map: Map<string, CacheEntry<T>>, key: string, ttlMs: number): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ttlMs) return null;
  return hit.data;
}

function setCached<T>(map: Map<string, CacheEntry<T>>, key: string, data: T) {
  map.set(key, { ts: Date.now(), data });
}

export function useRaffleDetails(raffleAddress: string | null, open: boolean) {
  const [data, setData] = useState<RaffleDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const normalizedAddress = useMemo(() => {
    if (!raffleAddress) return null;
    try {
      return getAddress(raffleAddress);
    } catch {
      return raffleAddress;
    }
  }, [raffleAddress]);

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

    let alive = true;
    const ac = new AbortController();

    // 1) Fast-path: serve cached details immediately (smooth UX + fewer RPC calls)
    const cachedDetails = getCached(detailsCache, normalizedAddress.toLowerCase(), DETAILS_TTL_MS);
    if (cachedDetails) {
      setData(cachedDetails);
      setLoading(false);
      setNote(null);
      // We still allow a refresh if cache is slightly old? (kept simple: return early)
      return () => {
        alive = false;
        try {
          ac.abort();
        } catch {}
      };
    }

    (async () => {
      setLoading(true);
      setNote(null);

      const cacheKey = normalizedAddress.toLowerCase();

      // 2) Cache subgraph history too (avoids indexer spam)
      const cachedHistory = getCached(historyCache, cacheKey, HISTORY_TTL_MS);
      const historyP: Promise<RaffleHistory | null> = cachedHistory
        ? Promise.resolve(cachedHistory)
        : fetchRaffleHistoryFromSubgraph(normalizedAddress, ac.signal)
            .then((h) => {
              setCached(historyCache, cacheKey, h);
              return h;
            })
            .catch(() => null);

      try {
        // On-chain reads (parallel, with better candidates so fewer failures)
        const [
          name,
          statusU8,
          sold,
          ticketPrice,
          winningPot,
          minTickets,
          maxTickets,
          deadline,
          paused,
          usdcToken,
          creator,
          winner,
          winningTicketIndex,
          feeRecipient,
          protocolFeePercent,
          ticketRevenue,
          minPurchaseAmount,
          finalizeRequestId,
          callbackGasLimit,
          entropy,
          entropyProvider,
          entropyRequestId,
          selectedProvider,
          history,
        ] = await Promise.all([
          readFirstOr(contract, "name", ["function name() view returns (string)"], "Unknown raffle"),
          readFirstOr(contract, "status", ["function status() view returns (uint8)"], 255),

          // sold: some contracts expose sold() instead of getSold()
          readFirstOr(contract, "sold", ["function getSold() view returns (uint256)", "function sold() view returns (uint256)"], 0n),

          readFirstOr(contract, "ticketPrice", ["function ticketPrice() view returns (uint256)"], 0n),
          readFirstOr(contract, "winningPot", ["function winningPot() view returns (uint256)"], 0n),

          readFirstOr(contract, "minTickets", ["function minTickets() view returns (uint64)"], 0),
          readFirstOr(contract, "maxTickets", ["function maxTickets() view returns (uint64)"], 0),
          readFirstOr(contract, "deadline", ["function deadline() view returns (uint64)"], 0),

          readFirstOr(contract, "paused", ["function paused() view returns (bool)"], false),

          // token / roles
          readFirstOr(contract, "usdcToken", ["function usdcToken() view returns (address)", "function usdc() view returns (address)"], ZERO),
          readFirstOr(contract, "creator", ["function creator() view returns (address)", "function owner() view returns (address)"], ZERO),

          // winner
          readFirstOr(contract, "winner", ["function winner() view returns (address)"], ZERO),
          readFirstOr(contract, "winningTicketIndex", ["function winningTicketIndex() view returns (uint256)"], 0n),

          // fees
          readFirstOr(contract, "feeRecipient", ["function feeRecipient() view returns (address)"], ZERO),
          readFirstOr(contract, "protocolFeePercent", ["function protocolFeePercent() view returns (uint256)"], 0n),

          // revenue
          readFirstOr(contract, "ticketRevenue", ["function ticketRevenue() view returns (uint256)"], 0n),

          readFirstOr(contract, "minPurchaseAmount", ["function minPurchaseAmount() view returns (uint32)"], 1),

          // request ids vary between versions
          readFirstOr(
            contract,
            "finalizeRequestId",
            ["function finalizeRequestId() view returns (uint64)", "function entropyRequestId() view returns (uint64)"],
            0
          ),

          readFirstOr(contract, "callbackGasLimit", ["function callbackGasLimit() view returns (uint32)"], 0),

          readFirstOr(contract, "entropy", ["function entropy() view returns (address)"], ZERO),
          readFirstOr(contract, "entropyProvider", ["function entropyProvider() view returns (address)"], ZERO),
          readFirstOr(contract, "entropyRequestId", ["function entropyRequestId() view returns (uint64)"], 0),
          readFirstOr(contract, "selectedProvider", ["function selectedProvider() view returns (address)"], ZERO),

          historyP,
        ]);

        if (!alive) return;

        const onchainStatus = statusFromUint8(Number(statusU8));
        const subgraphStatus = statusFromSubgraph(history?.status);

        // Prefer subgraph terminal statuses when available
        const finalStatus: RaffleStatus =
          subgraphStatus === "CANCELED" ||
          subgraphStatus === "COMPLETED" ||
          subgraphStatus === "DRAWING"
            ? subgraphStatus
            : onchainStatus;

        const next: RaffleDetails = {
          address: normalizedAddress,
          name: String(name),
          status: finalStatus,

          sold: String(sold),
          ticketRevenue: String(ticketRevenue),

          ticketPrice: String(ticketPrice),
          winningPot: String(winningPot),

          minTickets: String(minTickets),
          maxTickets: String(maxTickets),
          deadline: String(deadline),
          paused: Boolean(paused),

          minPurchaseAmount: String(minPurchaseAmount),
          finalizeRequestId: String(finalizeRequestId),
          callbackGasLimit: String(callbackGasLimit),

          usdcToken: String(usdcToken),
          creator: String(creator),

          winner: String(winner),
          winningTicketIndex: String(winningTicketIndex),

          feeRecipient: String(feeRecipient),
          protocolFeePercent: String(protocolFeePercent),

          entropy: String(entropy),
          entropyProvider: String(entropyProvider),
          entropyRequestId: String(entropyRequestId),
          selectedProvider: String(selectedProvider),

          history: history ?? undefined,
        };

        setData(next);
        setCached(detailsCache, cacheKey, next);

        if (String(name) === "Unknown raffle") {
          setNote("Some live fields could not be read yet, but the raffle is reachable.");
        }
      } catch (e) {
        if (!alive) return;
        setData(null);
        setCached(detailsCache, normalizedAddress.toLowerCase(), null);
        setNote("Could not load this raffle right now. Please refresh (and check console logs).");
      } finally {
        if (!alive) return;
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