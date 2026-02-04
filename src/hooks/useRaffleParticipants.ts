// src/hooks/useRaffleParticipants.ts
import { useState, useEffect } from "react";
import { fetchRaffleParticipants, type RaffleParticipantItem } from "../indexer/subgraph";

export type ParticipantUI = RaffleParticipantItem & {
  percentage: string;
};

export function useRaffleParticipants(raffleId: string | null, totalSold: number) {
  const [data, setData] = useState<ParticipantUI[]>([]);
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
        // Fetch using the updated function in subgraph.ts
        const raw = await fetchRaffleParticipants(raffleId);
        
        if (!active) return;

        // Calculate Percentages
        const formatted: ParticipantUI[] = raw.map((p) => {
          const count = Number(p.ticketsPurchased); // Convert string to number
          const pct = totalSold > 0 ? ((count / totalSold) * 100).toFixed(1) : "0.0";
          
          return {
            ...p,
            percentage: pct
          };
        });

        setData(formatted);
      } catch (err) {
        console.error("Failed to load participants", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();

    return () => { active = false; };
  }, [raffleId, totalSold]);

  return { participants: data, isLoading };
}
