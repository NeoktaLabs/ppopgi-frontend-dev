// src/features/raffles/useRafflesExplore.ts
import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "../../lib/subgraph";
import { QUERY_EXPLORE_RAFFLES } from "../../lib/queries";
import type { RaffleLite } from "./useRafflesHome";

export type ExploreStatusFilter =
  | "ALL"
  | "ACTIVE"
  | "EXPIRED"
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED"
  | "PAUSED";

export type ExploreSortBy = "ticketPrice" | "winningPot" | "deadline";
export type ExploreSortDir = "asc" | "desc";

function nowBigInt(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function buildWhere(status: ExploreStatusFilter) {
  const now = nowBigInt();

  // NOTE: "Expired" is UI-derived normally, BUT we can still filter using deadline in GraphQL
  // so the list is correct without fetching everything.
  switch (status) {
    case "ALL":
      return {};
    case "ACTIVE":
      // On-chain status OPEN + deadline in the future (UI "active")
      return { status: "OPEN", paused: false, deadline_gt: now };
    case "EXPIRED":
      // OPEN but deadline in past (UI "expired")
      return { status: "OPEN", deadline_lte: now };
    case "PAUSED":
      return { paused: true };
    case "OPEN":
      return { status: "OPEN" };
    case "FUNDING_PENDING":
    case "DRAWING":
    case "COMPLETED":
    case "CANCELED":
      return { status };
    default:
      return {};
  }
}

export function useExploreRaffles({
  status,
  sortBy,
  sortDir,
  pageSize = 24,
  skip = 0,
}: {
  status: ExploreStatusFilter;
  sortBy: ExploreSortBy;
  sortDir: ExploreSortDir;
  pageSize?: number;
  skip?: number;
}) {
  return useQuery({
    queryKey: ["explore", { status, sortBy, sortDir, pageSize, skip }],
    queryFn: async () => {
      const client = getSubgraphClient();
      const where = buildWhere(status);

      return client.request<{ raffles: RaffleLite[] }>(QUERY_EXPLORE_RAFFLES, {
        first: pageSize,
        skip,
        where,
        orderBy: sortBy,
        orderDirection: sortDir.toUpperCase(), // Graph expects ASC/DESC usually; but Studio supports "asc/desc" too
      });
    },
    refetchInterval: 20_000,
    retry: 1,
  });
}