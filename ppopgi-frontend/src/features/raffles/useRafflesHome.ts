// src/features/raffles/useRafflesHome.ts
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
  verified?: boolean; // NEW
};

function nowBigInt(): string {
  return Math.floor(Date.now() / 1000).toString();
}

export function useBigPrizes() {
  return useQuery({
    queryKey: ["home", "bigPrizes"],
    queryFn: async () => {
      const client = getSubgraphClient();
      const res = await client.request<{ raffles: RaffleLite[] }>(QUERY_BIG_PRIZES, { first: 3 });

      return {
        ...res,
        raffles: (res.raffles ?? []).map((r) => ({ ...r, verified: true })), // you said you register all raffles
      };
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
      const res = await client.request<{ raffles: RaffleLite[] }>(QUERY_ENDING_SOON, {
        first: 5,
        now: nowBigInt(),
      });

      return {
        ...res,
        raffles: (res.raffles ?? []).map((r) => ({ ...r, verified: true })), // you said you register all raffles
      };
    },
    refetchInterval: 20_000,
    retry: 1,
  });
}