// src/hooks/useRaffleDetails.ts
import { useEffect, useMemo, useRef, useState } from "react";
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

// --------------------
// tiny helpers
// --------------------
function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, rej) => {
    t = setTimeout(() => rej(new Error(label)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function gqlFetchTextFirst<T>(
  url: string,
  query: string,
  variables: Record<string, any>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) throw new Error(`SUBGRAPH_HTTP_ERROR_${res.status}`);
    throw new Error("SUBGRAPH_BAD_JSON");
  }

  if (!res.ok) throw new Error(`SUBGRAPH_HTTP_ERROR_${res.status}`);
  if (json?.errors?.length) throw new Error("SUBGRAPH_GQL_ERROR");
  return json.data as T;
}

async function readFirst(contract: any, candidates: string[], params: readonly unknown[] = []): Promise<any> {
  let lastErr: any = null;
  for (const method of candidates) {
    try {
      return await readContract({ contract, method, params });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function readFirstOr(contract: any, candidates: string[], fallback: any, params: readonly unknown[] = []) {
  try {
    return await readFirst(contract, candidates, params);
  } catch {
    return fallback;
  }
}

// --------------------
// subgraph history
// --------------------
async function fetchRaffleHistoryFromSubgraph(id: string, signal?: AbortSignal): Promise<RaffleHistory | null> {
  const raffleId = id.toLowerCase();
  const url = mustEnv("VITE_SUBGRAPH_URL");

  // NOTE: if your schema wants Bytes!, change $id: ID! to Bytes!
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

  type Resp = { raffle: any | null };
  const data = await gqlFetchTextFirst<Resp>(url, query, { id: raffleId }, signal);
  const r = data?.raffle;
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

// --------------------
// in-memory cache (fast reopen)
// --------------------
type CacheEntry = { ts: number; data: RaffleDetails };
const DETAILS_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 20_000;

// --------------------
// hook
// --------------------
export function useRaffleDetails(raffleAddress: string | null, open: boolean) {
  const [data, setData] = useState<RaffleDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const lastKeyRef = useRef<string | null>(null);

  const normalizedAddress = useMemo(() => {
    if (!raffleAddress) return null;
    try {
      return getAddress(raffleAddress);
    } catch {
      return String(raffleAddress);
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
    const key = normalizedAddress.toLowerCase();
    lastKeyRef.current = key;

    // ✅ serve cache instantly (still refresh in background)
    const cached = DETAILS_CACHE.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setData(cached.data);
      setLoading(false);
      setNote(null);
    } else {
      setLoading(true);
      setNote(null);
    }

    (async () => {
      try {
        // subgraph history in parallel
        const historyP = withTimeout(fetchRaffleHistoryFromSubgraph(normalizedAddress, ac.signal).catch(() => null), 4500, "subgraph_timeout");

        // onchain reads in parallel
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
          withTimeout(readFirstOr(contract, ["function name() view returns (string)"], "Unknown raffle"), 4000, "rpc_timeout"),
          withTimeout(readFirstOr(contract, ["function status() view returns (uint8)"], 255), 4000, "rpc_timeout"),

          withTimeout(
            readFirstOr(contract, ["function getSold() view returns (uint256)", "function sold() view returns (uint256)"], 0n),
            4000,
            "rpc_timeout"
          ),

          withTimeout(readFirstOr(contract, ["function ticketPrice() view returns (uint256)"], 0n), 4000, "rpc_timeout"),
          withTimeout(readFirstOr(contract, ["function winningPot() view returns (uint256)"], 0n), 4000, "rpc_timeout"),

          withTimeout(readFirstOr(contract, ["function minTickets() view returns (uint64)"], 0), 4000, "rpc_timeout"),
          withTimeout(readFirstOr(contract, ["function maxTickets() view returns (uint64)"], 0), 4000, "rpc_timeout"),

          withTimeout(readFirstOr(contract, ["function deadline() view returns (uint64)"], 0), 4000, "rpc_timeout"),
          withTimeout(readFirstOr(contract, ["function paused() view returns (bool)"], false), 4000, "rpc_timeout"),

          withTimeout(
            readFirstOr(contract, ["function usdcToken() view returns (address)", "function usdc() view returns (address)"], ZERO),
            4000,
            "rpc_timeout"
          ),

          withTimeout(
            readFirstOr(contract, ["function creator() view returns (address)", "function owner() view returns (address)"], ZERO),
            4000,
            "rpc_timeout"
          ),

          withTimeout(readFirstOr(contract, ["function winner() view returns (address)"], ZERO), 4000, "rpc_timeout"),

          withTimeout(
            readFirstOr(contract, ["function winningTicketIndex() view returns (uint256)"], 0n),
            4000,
            "rpc_timeout"
          ),

          withTimeout(readFirstOr(contract, ["function feeRecipient() view returns (address)"], ZERO), 4000, "rpc_timeout"),
          withTimeout(readFirstOr(contract, ["function protocolFeePercent() view returns (uint256)"], 0n), 4000, "rpc_timeout"),

          withTimeout(readFirstOr(contract, ["function ticketRevenue() view returns (uint256)"], 0n), 4000, "rpc_timeout"),

          withTimeout(readFirstOr(contract, ["function minPurchaseAmount() view returns (uint32)"], 1), 4000, "rpc_timeout"),

          withTimeout(
            readFirstOr(contract, ["function finalizeRequestId() view returns (uint64)", "function entropyRequestId() view returns (uint64)"], 0),
            4000,
            "rpc_timeout"
          ),

          withTimeout(readFirstOr(contract, ["function callbackGasLimit() view returns (uint32)"], 0), 4000, "rpc_timeout"),

          withTimeout(readFirstOr(contract, ["function entropy() view returns (address)"], ZERO), 4000, "rpc_timeout"),
          withTimeout(readFirstOr(contract, ["function entropyProvider() view returns (address)"], ZERO), 4000, "rpc_timeout"),
          withTimeout(readFirstOr(contract, ["function entropyRequestId() view returns (uint64)"], 0), 4000, "rpc_timeout"),
          withTimeout(readFirstOr(contract, ["function selectedProvider() view returns (address)"], ZERO), 4000, "rpc_timeout"),

          historyP,
        ]);

        if (!alive) return;
        if (lastKeyRef.current !== key) return;

        const onchainStatus = statusFromUint8(Number(statusU8));
        const subgraphStatus = statusFromSubgraph(history?.status);

        // Prefer terminal-ish subgraph statuses when present
        const finalStatus: RaffleStatus =
          subgraphStatus === "CANCELED" || subgraphStatus === "COMPLETED" || subgraphStatus === "DRAWING"
            ? subgraphStatus
            : onchainStatus;

        const out: RaffleDetails = {
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

        DETAILS_CACHE.set(key, { ts: Date.now(), data: out });

        setData(out);
        setNote(null);

        if (String(name) === "Unknown raffle" || String(usdcToken).toLowerCase() === ZERO) {
          setNote("Some live fields could not be read yet, but the raffle is reachable.");
        }
      } catch (e: any) {
        if (!alive) return;
        setData(null);
        setNote("Could not load this raffle right now. Please refresh.");
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