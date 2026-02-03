// src/utils/share.ts
export function getRaffleShareUrl(raffleId: string) {
  const base = window.location.origin + window.location.pathname; // no extra params
  const url = new URL(base);
  url.searchParams.set("raffle", raffleId);
  return url.toString();
}