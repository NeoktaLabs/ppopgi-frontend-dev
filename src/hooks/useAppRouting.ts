import { useEffect, useState } from "react";

function extractAddress(input: string): string | null {
  const m = input?.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0] : null;
}

export function useAppRouting() {
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);

  // Sync URL to State
  useEffect(() => {
    const getParam = () => {
      const url = new URL(window.location.href);
      return extractAddress(url.searchParams.get("raffle") || "");
    };

    setSelectedRaffleId(getParam());

    const onPop = () => setSelectedRaffleId(getParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Sync State to URL
  const openRaffle = (id: string) => {
    const addr = extractAddress(id) ?? id;
    setSelectedRaffleId(addr);
    
    try {
        const url = new URL(window.location.href);
        url.searchParams.set("raffle", addr);
        window.history.pushState({}, "", url.toString());
    } catch {}
  };

  const closeRaffle = () => {
    setSelectedRaffleId(null);
    try {
        const url = new URL(window.location.href);
        url.search = "";
        window.history.pushState({}, "", url.toString());
    } catch {}
  };

  return { selectedRaffleId, openRaffle, closeRaffle };
}
