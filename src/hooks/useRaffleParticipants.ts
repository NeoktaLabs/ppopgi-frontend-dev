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
        // 1. Fetch from your new Subgraph function
        const raw = await fetchRaffleParticipants(raffleId);
        
        if (!active) return;

        // 2. Format and Calculate Percentage
        const formatted: ParticipantUI[] = raw.map((p) => {
          const count = Number(p.ticketsPurchased);
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
