import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "../../lib/subgraph";
import { QUERY_BIG_PRIZES, QUERY_ENDING_SOON } from "../../lib/queries";

export type RaffleLite = {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  ticketPrice: string;
  deadline: string;
  sold: string;
  winningPot: string;
  maxTickets?: string | null;
};

function nowBigInt(): string {
  return Math.floor(Date.now() / 1000).toString();
}

export function useBigPrizes() {
  return useQuery({
    queryKey: ["home", "bigPrizes"],
    queryFn: async () => {
      const client = getSubgraphClient();
      return client.request<{ raffles: RaffleLite[] }>(QUERY_BIG_PRIZES, { first: 3 });
    },
    refetchInterval: 20_000,
    retry: 1,
  });
}

export function useEndingSoon() {
  return useQuery({
    queryKey: ["home", "endingSoon"],
    queryFn: async () => {
      const client = getSubgraphClient();
      return client.request<{ raffles: RaffleLite[] }>(QUERY_ENDING_SOON, {
        first: 5,
        now: nowBigInt(),
      });
    },
    refetchInterval: 20_000,
    retry: 1,
  });
}