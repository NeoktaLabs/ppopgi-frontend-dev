// src/indexer/subgraph.ts

export type RaffleStatus =
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED";

export type RaffleListItem = {
  id: string;
  name: string;
  status: RaffleStatus;
  deployer: string | null;
  registry: string | null;
  typeId: string | null;
  registryIndex: string | null;
  isRegistered: boolean;
  registeredAt: string | null;
  creator: string;
  createdAtBlock: string;
  createdAtTimestamp: string; // ✅ Field needed for "Created" date
  creationTx: string;
  usdc: string;
  entropy: string;
  entropyProvider: string;
  feeRecipient: string;
  protocolFeePercent: string;
  callbackGasLimit: string;
  minPurchaseAmount: string;
  winningPot: string;
  ticketPrice: string;
  deadline: string;
  minTickets: string;
  maxTickets: string;
  sold: string;
  ticketRevenue: string;
  paused: boolean;
  finalizeRequestId: string | null;
  finalizedAt: string | null;
  selectedProvider: string | null;
  winner: string | null;
  winningTicketIndex: string | null;
  completedAt: string | null;
  canceledReason: string | null;
  canceledAt: string | null;
  soldAtCancel: string | null;
  lastUpdatedBlock: string;
  lastUpdatedTimestamp: string;
};

// Simple Ticket Type
export type TicketItem = {
  owner: string; 
};

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

type FetchRafflesOptions = {
  first?: number;
  signal?: AbortSignal;
};

export async function fetchRafflesFromSubgraph(
  opts: FetchRafflesOptions = {}
): Promise<RaffleListItem[]> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const first = Math.min(Math.max(opts.first ?? 500, 1), 1000);

  const query = `
    query HomeRaffles($first: Int!) {
      raffles(
        first: $first
        orderBy: lastUpdatedTimestamp
        orderDirection: desc
      ) {
        id
        name
        status
        deployer
        registry
        typeId
        registryIndex
        isRegistered
        registeredAt
        creator
        createdAtBlock
        createdAtTimestamp
        creationTx
        usdc
        entropy
        entropyProvider
        feeRecipient
        protocolFeePercent
        callbackGasLimit
        minPurchaseAmount
        winningPot
        ticketPrice
        deadline
        minTickets
        maxTickets
        sold
        ticketRevenue
        paused
        finalizeRequestId
        finalizedAt
        selectedProvider
        winner
        winningTicketIndex
        completedAt
        canceledReason
        canceledAt
        soldAtCancel
        lastUpdatedBlock
        lastUpdatedTimestamp
      }
    }
  `;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { first } }),
    signal: opts.signal,
  });

  if (!res.ok) throw new Error("SUBGRAPH_HTTP_ERROR");
  const json = await res.json();
  if (json?.errors?.length) throw new Error("SUBGRAPH_GQL_ERROR");

  const raffles = (json.data?.raffles ?? []) as RaffleListItem[];

  return raffles.map((r) => ({
    ...r,
    id: String(r.id).toLowerCase(),
  }));
}

/**
 * ✅ FETCH TICKETS for Leaderboard
 * Queries the specific 'Ticket' entity linked to the raffle.
 */
export async function fetchRaffleTickets(raffleId: string): Promise<TicketItem[]> {
  const url = mustEnv("VITE_SUBGRAPH_URL");

  const query = `
    query GetTickets($raffleId: String!) {
      tickets(
        where: { raffle: $raffleId }
        first: 1000
      ) {
        owner
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { raffleId: raffleId.toLowerCase() } }),
    });

    if (!res.ok) {
      console.error("Subgraph ticket fetch failed", res.status);
      return [];
    }
    
    const json = await res.json();
    const raw = (json.data?.tickets ?? []) as any[];
    
    return raw.map(t => ({
      owner: t.owner // Graph returns address bytes as hex string automatically
    }));
  } catch (e) {
    console.error("Error fetching tickets:", e);
    return [];
  }
}
