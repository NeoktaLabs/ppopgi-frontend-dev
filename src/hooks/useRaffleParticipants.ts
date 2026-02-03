// src/hooks/useRaffleParticipants.ts
import { useState, useEffect } from "react";
import { fetchRaffleTickets } from "../indexer/subgraph";

export type Participant = {
  address: string;
  count: number;
  percentage: string;
};

export function useRaffleParticipants(raffleId: string | null) {
  const [data, setData] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!raffleId) {
      setData([]);
      return;
    }

    let active = true;

    const load = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch raw tickets (up to 1000)
        // Ensure you have added fetchRaffleTickets to your src/indexer/subgraph.ts!
        const tickets = await fetchRaffleTickets(raffleId);
        
        if (!active) return;

        // 2. Aggregate by Owner (Client-side Group By)
        const counts: Record<string, number> = {};
        tickets.forEach(t => {
          const owner = t.owner.toLowerCase();
          counts[owner] = (counts[owner] || 0) + 1;
        });

        const totalFetched = tickets.length;

        // 3. Convert to Array & Sort
        const leaderboard: Participant[] = Object.entries(counts).map(([address, count]) => ({
          address,
          count,
          percentage: totalFetched > 0 ? ((count / totalFetched) * 100).toFixed(1) : "0.0"
        }));

        // Sort descending (Whales first)
        leaderboard.sort((a, b) => b.count - a.count);

        setData(leaderboard);
      } catch (err) {
        console.error("Failed to load participants", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();

    return () => { active = false; };
  }, [raffleId]);

  return { participants: data, isLoading };
}
