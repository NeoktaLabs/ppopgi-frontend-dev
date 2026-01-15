import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getSubgraphClient } from "../../lib/subgraph";
import { QUERY_MY_ACTIVITY_EVENTS, QUERY_MY_CREATED_RAFFLES } from "../../lib/queries";

type RaffleLite = {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  ticketPrice: string;
  winningPot: string;
  deadline: string;
  sold: string;
  minTickets?: string;
  maxTickets?: string | null;
  createdAtTimestamp?: string;
  creationTx?: string;
  winner?: string | null;
  winningTicketIndex?: string | null;
  canceledAt?: string | null;
  canceledReason?: string | null;
};

type ActivityEvent = {
  type: string;
  blockTimestamp: string;
  txHash?: string | null;
  amount?: string | null;
  amount2?: string | null;
  raffle: RaffleLite;
};

function toBytesAddress(addr?: string) {
  return addr ? addr.toLowerCase() : "";
}

export function useDashboard() {
  const { address, isConnected } = useAccount();
  const me = useMemo(() => toBytesAddress(address), [address]);

  const createdQ = useQuery({
    queryKey: ["dashboard", "created", me],
    enabled: isConnected && !!me,
    queryFn: async () => {
      const client = getSubgraphClient();
      return client.request<{ raffles: RaffleLite[] }>(QUERY_MY_CREATED_RAFFLES, { me, first: 50 });
    },
    retry: 1,
    refetchInterval: 20_000,
  });

  const activityQ = useQuery({
    queryKey: ["dashboard", "activity", me],
    enabled: isConnected && !!me,
    queryFn: async () => {
      const client = getSubgraphClient();
      return client.request<{ raffleEvents: ActivityEvent[] }>(QUERY_MY_ACTIVITY_EVENTS, {
        me,
        first: 200,
      });
    },
    retry: 1,
    refetchInterval: 20_000,
  });

  const activityByRaffle = useMemo(() => {
    const map = new Map<string, { raffle: RaffleLite; latestTs: number; types: Set<string> }>();
    const evs = activityQ.data?.raffleEvents ?? [];
    for (const e of evs) {
      const id = (e.raffle?.id ?? "").toLowerCase();
      if (!id) continue;
      const ts = Number(e.blockTimestamp || 0);
      const cur = map.get(id);
      if (!cur) {
        map.set(id, { raffle: e.raffle, latestTs: ts, types: new Set([e.type]) });
      } else {
        cur.latestTs = Math.max(cur.latestTs, ts);
        cur.types.add(e.type);
        // keep freshest raffle snapshot
        cur.raffle = e.raffle ?? cur.raffle;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.latestTs - a.latestTs);
  }, [activityQ.data]);

  return {
    me,
    createdQ,
    activityQ,
    activityByRaffle,
  };
}