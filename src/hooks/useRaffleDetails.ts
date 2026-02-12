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

/**
 * ✅ IMPORTANT CHANGE:
 * Returns { ok, value } instead of forcing fallback "0".
 * This lets us avoid overwriting good cached values with zero.
 */
async function safeRead<T>(
  label: string,
  p: Promise<T>,
  ms = 4000
): Promise<{ ok: true; value: T } | { ok: false; value: undefined; err: any; label: string }> {
  try {
    const v = await withTimeout(p, ms, `${label}_timeout`);
    return { ok: true, value: v };
  } catch (err) {
    return { ok: false, value: undefined, err, label };
  }
}

function toStr(v: any, fb = "0") {
  try {
    if (v === null || v === undefined) return fb;
    return String(v);
  } catch {
    return fb;
  }
}

function lower(a: any) {
  return String(a || "").toLowerCase();
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
    const hasFreshCache = cached && Date.now() - cached.ts < CACHE_TTL_MS;

    if (hasFreshCache) {
      setData(cached!.data);
      setLoading(false);
      setNote(null);
    } else {
      setLoading(true);
      setNote(null);
    }

    (async () => {
      // base object: cached if exists, otherwise a minimal skeleton
      const base: RaffleDetails =
        (cached?.data as RaffleDetails) ||
        ({
          address: normalizedAddress,
          name: "Unknown raffle",
          status: "UNKNOWN",

          sold: "0",
          ticketRevenue: "0",

          ticketPrice: "0",
          winningPot: "0",

          minTickets: "0",
          maxTickets: "0",
          deadline: "0",
          paused: false,

          minPurchaseAmount: "1",

          finalizeRequestId: "0",
          callbackGasLimit: "0",

          usdcToken: ZERO,
          creator: ZERO,

          winner: ZERO,
          winningTicketIndex: "0",

          feeRecipient: ZERO,
          protocolFeePercent: "0",

          entropy: ZERO,
          entropyProvider: ZERO,
          entropyRequestId: "0",
          selectedProvider: ZERO,
        } as RaffleDetails);

      try {
        // subgraph history in parallel (timeout, but doesn't kill whole hook)
        const historyP = withTimeout(
          fetchRaffleHistoryFromSubgraph(normalizedAddress, ac.signal).catch(() => null),
          4500,
          "subgraph_timeout"
        );

        // ✅ safe onchain reads (do NOT force 0 into state on failure)
        const reads = await Promise.all([
          safeRead("name", readFirst(contract, ["function name() view returns (string)"])),
          safeRead("status", readFirst(contract, ["function status() view returns (uint8)"])),
          safeRead("sold", readFirst(contract, ["function getSold() view returns (uint256)", "function sold() view returns (uint256)"])),
          safeRead("ticketPrice", readFirst(contract, ["function ticketPrice() view returns (uint256)"])),
          safeRead("winningPot", readFirst(contract, ["function winningPot() view returns (uint256)"])),

          safeRead("minTickets", readFirst(contract, ["function minTickets() view returns (uint64)"])),
          safeRead("maxTickets", readFirst(contract, ["function maxTickets() view returns (uint64)"])),

          safeRead("deadline", readFirst(contract, ["function deadline() view returns (uint64)"])),
          safeRead("paused", readFirst(contract, ["function paused() view returns (bool)"])),

          safeRead("usdcToken", readFirst(contract, ["function usdcToken() view returns (address)", "function usdc() view returns (address)"])),
          safeRead("creator", readFirst(contract, ["function creator() view returns (address)", "function owner() view returns (address)"])),

          safeRead("winner", readFirst(contract, ["function winner() view returns (address)"])),
          safeRead("winningTicketIndex", readFirst(contract, ["function winningTicketIndex() view returns (uint256)"])),

          safeRead("feeRecipient", readFirst(contract, ["function feeRecipient() view returns (address)"])),
          safeRead("protocolFeePercent", readFirst(contract, ["function protocolFeePercent() view returns (uint256)"])),

          safeRead("ticketRevenue", readFirst(contract, ["function ticketRevenue() view returns (uint256)"])),

          safeRead("minPurchaseAmount", readFirst(contract, ["function minPurchaseAmount() view returns (uint32)"])),

          safeRead(
            "finalizeRequestId",
            readFirst(contract, ["function finalizeRequestId() view returns (uint64)", "function entropyRequestId() view returns (uint64)"])
          ),

          safeRead("callbackGasLimit", readFirst(contract, ["function callbackGasLimit() view returns (uint32)"])),

          safeRead("entropy", readFirst(contract, ["function entropy() view returns (address)"])),
          safeRead("entropyProvider", readFirst(contract, ["function entropyProvider() view returns (address)"])),
          safeRead("entropyRequestId", readFirst(contract, ["function entropyRequestId() view returns (uint64)"])),
          safeRead("selectedProvider", readFirst(contract, ["function selectedProvider() view returns (address)"])),
        ]);

        const history = await historyP;

        if (!alive) return;
        if (lastKeyRef.current !== key) return;

        // build next by patching base only where read ok
        const next: RaffleDetails = { ...base, address: normalizedAddress };

        // convenience mapper by index
        const [
          rName,
          rStatus,
          rSold,
          rTicketPrice,
          rWinningPot,
          rMinTickets,
          rMaxTickets,
          rDeadline,
          rPaused,
          rUsdcToken,
          rCreator,
          rWinner,
          rWinningTicketIndex,
          rFeeRecipient,
          rProtocolFeePercent,
          rTicketRevenue,
          rMinPurchaseAmount,
          rFinalizeRequestId,
          rCallbackGasLimit,
          rEntropy,
          rEntropyProvider,
          rEntropyRequestId,
          rSelectedProvider,
        ] = reads;

        if (rName.ok) next.name = String(rName.value);
        if (rSold.ok) next.sold = toStr(rSold.value, next.sold);
        if (rTicketRevenue.ok) next.ticketRevenue = toStr(rTicketRevenue.value, next.ticketRevenue);

        // ✅ key fix: only overwrite pot/price if the read succeeded
        if (rTicketPrice.ok) next.ticketPrice = toStr(rTicketPrice.value, next.ticketPrice);
        if (rWinningPot.ok) next.winningPot = toStr(rWinningPot.value, next.winningPot);

        if (rMinTickets.ok) next.minTickets = toStr(rMinTickets.value, next.minTickets);
        if (rMaxTickets.ok) next.maxTickets = toStr(rMaxTickets.value, next.maxTickets);
        if (rDeadline.ok) next.deadline = toStr(rDeadline.value, next.deadline);
        if (rPaused.ok) next.paused = Boolean(rPaused.value);

        if (rMinPurchaseAmount.ok) next.minPurchaseAmount = toStr(rMinPurchaseAmount.value, next.minPurchaseAmount);

        if (rFinalizeRequestId.ok) next.finalizeRequestId = toStr(rFinalizeRequestId.value, next.finalizeRequestId);
        if (rCallbackGasLimit.ok) next.callbackGasLimit = toStr(rCallbackGasLimit.value, next.callbackGasLimit);

        if (rUsdcToken.ok) next.usdcToken = String(rUsdcToken.value);
        if (rCreator.ok) next.creator = String(rCreator.value);

        if (rWinner.ok) next.winner = String(rWinner.value);
        if (rWinningTicketIndex.ok) next.winningTicketIndex = toStr(rWinningTicketIndex.value, next.winningTicketIndex);

        if (rFeeRecipient.ok) next.feeRecipient = String(rFeeRecipient.value);
        if (rProtocolFeePercent.ok) next.protocolFeePercent = toStr(rProtocolFeePercent.value, next.protocolFeePercent);

        if (rEntropy.ok) next.entropy = String(rEntropy.value);
        if (rEntropyProvider.ok) next.entropyProvider = String(rEntropyProvider.value);
        if (rEntropyRequestId.ok) next.entropyRequestId = toStr(rEntropyRequestId.value, next.entropyRequestId);
        if (rSelectedProvider.ok) next.selectedProvider = String(rSelectedProvider.value);

        // status: derive from onchain if we got it, otherwise keep base
        const onchainStatus = rStatus.ok ? statusFromUint8(Number(rStatus.value as any)) : (next.status || "UNKNOWN");
        const subgraphStatus = statusFromSubgraph(history?.status);

        next.status =
          subgraphStatus === "CANCELED" || subgraphStatus === "COMPLETED" || subgraphStatus === "DRAWING"
            ? subgraphStatus
            : onchainStatus;

        next.history = history ?? next.history;

        // cache + commit
        DETAILS_CACHE.set(key, { ts: Date.now(), data: next });
        setData(next);

        // Note: show a hint if some important reads failed (but DON'T nuke values)
        const importantFailed =
          !rWinningPot.ok || !rTicketPrice.ok || !rSold.ok || !rStatus.ok || !rName.ok || !rUsdcToken.ok;

        if (importantFailed) {
          setNote("Some live fields are still syncing (RPC/indexer lag). Values may update shortly.");
        } else if (String(next.name) === "Unknown raffle" || lower(next.usdcToken) === ZERO) {
          setNote("Some live fields could not be read yet, but the raffle is reachable.");
        } else {
          setNote(null);
        }
      } catch (e: any) {
        if (!alive) return;
        if (lastKeyRef.current !== key) return;

        // ✅ do NOT drop to null if we already had something (prevents 0/null flashes)
        const stillHave = DETAILS_CACHE.get(key)?.data || data;
        if (stillHave) {
          setData(stillHave as any);
          setNote("Could not refresh live details right now. Showing last known values.");
        } else {
          setData(null);
          setNote("Could not load this raffle right now. Please refresh.");
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract, normalizedAddress]);

  return { data, loading, note };
}