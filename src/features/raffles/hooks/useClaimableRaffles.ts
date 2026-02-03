// src/hooks/useClaimableRaffles.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../../../shared/lib/indexer/subgraph";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../../../shared/lib/thirdweb/client";
import { ETHERLINK_CHAIN } from "../../../shared/lib/thirdweb/etherlink";

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

function norm(a: string) {
  return a.trim().toLowerCase();
}

function isHexAddress(a: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}

export type ClaimableRaffleItem = {
  raffle: RaffleListItem;
  roles: { created: boolean; participated: boolean };

  // live on-chain claimables for the active user
  claimableUsdc: string; // raw uint256 as string
  claimableNative: string; // raw uint256 as string
  isCreator: boolean;

  // helps debug when UI shows 0 but reads failed
  readErrors?: string[];
};

type Mode = "indexer" | "empty";
type Merged = Array<{ raffle: RaffleListItem; roles: { created: boolean; participated: boolean } }>;

async function readWithFallback<T>(
  args: Parameters<typeof readContract>[0],
  fallbackMethodName?: string
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const v = await readContract(args);
    return { ok: true, value: v as any as T };
  } catch (e1: any) {
    if (!fallbackMethodName) return { ok: false, error: String(e1?.message || e1) };

    try {
      const v2 = await readContract({ ...(args as any), method: fallbackMethodName } as any);
      return { ok: true, value: v2 as any as T };
    } catch (e2: any) {
      const m1 = String(e1?.message || e1);
      const m2 = String(e2?.message || e2);
      return { ok: false, error: `${m1} | fallback: ${m2}` };
    }
  }
}

function safeBigInt(x: any): bigint {
  try {
    return BigInt(x ?? "0");
  } catch {
    return 0n;
  }
}

function shouldKeepZeroRow(item: {
  raffle: any;
  roles: { created: boolean; participated: boolean };
  readErrors?: string[];
  claimableUsdc: bigint;
  claimableNative: bigint;
}) {
  // If reads failed, keep so user can refresh and not miss money.
  if ((item.readErrors?.length ?? 0) > 0) return true;

  // If there is ANY value, keep.
  if (item.claimableUsdc > 0n || item.claimableNative > 0n) return true;

  // Refunds often happen on canceled raffles. Keep those for participants.
  // (Even if your claimableFunds/native reads show 0, the refund path may still exist.)
  const status = String(item.raffle?.status || "");
  if (item.roles.participated && status === "CANCELED") return true;

  // Otherwise: definitely nothing to claim -> drop it.
  return false;
}

export function useClaimableRaffles(userAddress: string | null, limit = 200) {
  const [items, setItems] = useState<ClaimableRaffleItem[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("indexer");

  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((x) => x + 1), []);

  const me = useMemo(() => (userAddress ? norm(userAddress) : null), [userAddress]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function fetchFromSubgraph(): Promise<{ merged: Merged }> {
      const url = mustEnv("VITE_SUBGRAPH_URL");
      const user = me;

      const query = `
        query Claimables($user: Bytes!, $first: Int!) {
          created: raffles(first: $first, where: { creator: $user }) {
            id
            name
            status
            winningPot
            ticketPrice
            deadline
            sold
            maxTickets
            protocolFeePercent
            feeRecipient
            deployer
            lastUpdatedTimestamp
            creator
          }

          participated: raffleEvents(
            first: $first,
            orderBy: blockTimestamp,
            orderDirection: desc,
            where: { type: TICKETS_PURCHASED, actor: $user }
          ) {
            raffle {
              id
              name
              status
              winningPot
              ticketPrice
              deadline
              sold
              maxTickets
              protocolFeePercent
              feeRecipient
              deployer
              lastUpdatedTimestamp
              creator
            }
          }
        }
      `;

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables: { user, first: limit } }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("SUBGRAPH_HTTP_ERROR");
      const json = await res.json();
      if (json?.errors?.length) throw new Error("SUBGRAPH_GQL_ERROR");

      const created = (json.data?.created ?? []) as RaffleListItem[];
      const participatedEvents = (json.data?.participated ?? []) as Array<{ raffle: any }>;
      const participated = participatedEvents.map((e) => e.raffle).filter(Boolean) as RaffleListItem[];

      const byId = new Map<string, { raffle: RaffleListItem; roles: { created: boolean; participated: boolean } }>();

      for (const r of created) {
        byId.set(norm(String(r.id)), { raffle: r, roles: { created: true, participated: false } });
      }

      for (const r of participated) {
        const key = norm(String(r.id));
        const prev = byId.get(key);
        if (prev) prev.roles.participated = true;
        else byId.set(key, { raffle: r, roles: { created: false, participated: true } });
      }

      const merged = Array.from(byId.values());

      merged.sort((a, b) => {
        const A = Number(a.raffle.lastUpdatedTimestamp || "0");
        const B = Number(b.raffle.lastUpdatedTimestamp || "0");
        return B - A;
      });

      return { merged };
    }

    async function enrichOnChain(merged: Merged): Promise<ClaimableRaffleItem[]> {
      if (!me) return [];

      const out: ClaimableRaffleItem[] = [];
      const batchSize = 10;

      // small perf win: reuse contract objects in this run
      const contractCache = new Map<string, any>();

      for (let i = 0; i < merged.length; i += batchSize) {
        const slice = merged.slice(i, i + batchSize);

        const results = await Promise.all(
          slice.map(async ({ raffle, roles }) => {
            const errors: string[] = [];

            const addr = String(raffle.id || "");
            if (!isHexAddress(addr)) {
              return {
                raffle,
                roles,
                claimableUsdc: "0",
                claimableNative: "0",
                isCreator: false,
                readErrors: [`BAD_RAFFLE_ADDRESS: ${addr}`],
              } satisfies ClaimableRaffleItem;
            }

            let raffleContract = contractCache.get(addr);
            if (!raffleContract) {
              raffleContract = getContract({
                client: thirdwebClient,
                chain: ETHERLINK_CHAIN,
                address: addr,
              });
              contractCache.set(addr, raffleContract);
            }

            const rFunds = await readWithFallback<bigint>(
              {
                contract: raffleContract,
                method: "function claimableFunds(address) view returns (uint256)",
                params: [me],
              } as any,
              "claimableFunds"
            );
            if (!rFunds.ok) errors.push(`claimableFunds: ${rFunds.error}`);

            const rNative = await readWithFallback<bigint>(
              {
                contract: raffleContract,
                method: "function claimableNative(address) view returns (uint256)",
                params: [me],
              } as any,
              "claimableNative"
            );
            if (!rNative.ok) errors.push(`claimableNative: ${rNative.error}`);

            const claimableUsdc = rFunds.ok ? safeBigInt(rFunds.value as any) : 0n;
            const claimableNative = rNative.ok ? safeBigInt(rNative.value as any) : 0n;

            // ✅ no on-chain creator() read: use subgraph field instead
            const creatorAddr = raffle.creator ? norm(String(raffle.creator)) : "";
            const isCreator = creatorAddr === me;

            const item: ClaimableRaffleItem = {
              raffle,
              roles,
              claimableUsdc: String(claimableUsdc),
              claimableNative: String(claimableNative),
              isCreator,
            };

            if (errors.length) item.readErrors = errors;

            // ✅ drop "definitely nothing" rows so they don't stick around after claiming
            if (
              !shouldKeepZeroRow({
                raffle,
                roles,
                readErrors: item.readErrors,
                claimableUsdc,
                claimableNative,
              })
            ) {
              // return a sentinel null-ish; filtered by caller
              return null as any;
            }

            return item;
          })
        );

        for (const r of results) {
          if (r) out.push(r);
        }

        if (!alive) return out;
      }

      return out;
    }

    (async () => {
      if (!me) {
        setMode("empty");
        setNote("Sign in to see your claims.");
        setItems([]);
        return;
      }

      setNote(null);
      setMode("indexer");
      setItems(null);

      try {
        const { merged } = await fetchFromSubgraph();
        if (!alive) return;

        if (!merged.length) {
          setItems([]);
          setNote("No raffles found for your address yet.");
          return;
        }

        const enriched = await enrichOnChain(merged);
        if (!alive) return;

        setItems(enriched);

        const failed = enriched.filter((x) => (x.readErrors?.length ?? 0) > 0).length;
        setNote(
          failed > 0
            ? `Some on-chain reads failed (${failed}). If a card shows “0” incorrectly, hit Refresh.`
            : null
        );
      } catch {
        if (!alive) return;
        setItems([]);
        setNote("Could not load your claims right now. Please refresh.");
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [me, limit, refreshKey]);

  return { items, note, mode, refetch };
}

/**
 * Backwards compatible alias (so existing imports keep working).
 * You can remove this after you update all imports.
 */
export const useCashierRaffles = useClaimableRaffles;
export type CashierRaffleItem = ClaimableRaffleItem;