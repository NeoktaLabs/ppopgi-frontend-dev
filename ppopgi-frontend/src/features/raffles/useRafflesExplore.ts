// src/features/raffles/useRafflesExplore.ts
import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "../../lib/subgraph";
import { QUERY_EXPLORE_RAFFLES } from "../../lib/queries";

export type ExploreSortBy = "deadline" | "ticketPrice" | "winningPot";
export type ExploreSortDir = "asc" | "desc";
export type ExploreStatusFilter =
  | "ALL"
  | "ACTIVE"
  | "EXPIRED"
  | "FUNDING_PENDING"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED"
  | "PAUSED";

export function useExploreRaffles({
  status,
  sortBy,
  sortDir,
  pageSize,
  skip,
}: {
  status: ExploreStatusFilter;
  sortBy: ExploreSortBy;
  sortDir: ExploreSortDir;
  pageSize: number;
  skip: number;
}) {
  return useQuery({
    queryKey: ["exploreRaffles", status, sortBy, sortDir, pageSize, skip],
    queryFn: async () => {
      const client = getSubgraphClient();

      const now = Math.floor(Date.now() / 1000);

      const where: any = {};
      if (status === "ACTIVE") where.status = "OPEN";
      if (status === "FUNDING_PENDING") where.status = "FUNDING_PENDING";
      if (status === "DRAWING") where.status = "DRAWING";
      if (status === "COMPLETED") where.status = "COMPLETED";
      if (status === "CANCELED") where.status = "CANCELED";
      if (status === "PAUSED") where.paused = true;

      // "Expired" means: still OPEN in subgraph but deadline has passed (lag window)
      if (status === "EXPIRED") {
        where.status = "OPEN";
        where.deadline_lt = now;
      }

      const orderBy =
        sortBy === "ticketPrice"
          ? "ticketPrice"
          : sortBy === "winningPot"
            ? "winningPot"
            : "deadline";

      return client.request(QUERY_EXPLORE_RAFFLES, {
        first: pageSize,
        skip,
        where,
        orderBy,
        orderDirection: sortDir, // ✅ keep lowercase
      });
    },
    // Optional improvement: keep Explore feeling live
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}