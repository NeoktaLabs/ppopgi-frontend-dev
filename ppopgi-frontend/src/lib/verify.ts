// src/lib/verify.ts
import { ADDR } from "./contracts";

export function isOfficialRaffleSubgraph(raffle?: {
  deployer?: string | null;
  isRegistered?: boolean | null;
}) {
  const dep = (raffle?.deployer ?? "").toLowerCase();
  const officialDeployer = ADDR.deployer.toLowerCase();

  // if fields missing, treat as unknown (so you can show “Checking…”)
  const hasData = !!raffle && raffle.isRegistered !== null && raffle.isRegistered !== undefined && !!dep;

  if (!hasData) return { known: false, official: false };

  const official = dep === officialDeployer && raffle.isRegistered === true;
  return { known: true, official };
}