// src/indexer/subgraph.ts

export type RaffleStatus =
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED";

/**
 * Home list item.
 */
export type RaffleListItem = {
  id: string; // raffle address
  name: string;
  status: RaffleStatus;

  // canonical discovery
  deployer: string | null;
  registry: string | null;
  typeId: string | null;
  registryIndex: string | null;
  isRegistered: boolean;
  registeredAt: string | null;

  // creation metadata
  creator: string;
  createdAtBlock: string;
  createdAtTimestamp: string;
  creationTx: string;

  // config / contracts
  usdc: string;
  entropy: string;
  entropyProvider: string;
  feeRecipient: string;
  protocolFeePercent: string;
  callbackGasLimit: string;
  minPurchaseAmount: string;

  // economics
  winningPot: string;
  ticketPrice: string;
  deadline: string;
  minTickets: string;
  maxTickets: string;

  // lifecycle / state
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

  // indexing metadata
  lastUpdatedBlock: string;
  lastUpdatedTimestamp: string;
};

// Simple Ticket Type for the Leaderboard
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

/**
 * Fetch latest raffles
 */
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
 * ✅ NEW: Fetch Tickets for a specific Raffle to build the Leaderboard
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

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { raffleId: raffleId.toLowerCase() } }),
  });

  if (!res.ok) return [];
  const json = await res.json();
  
  // Robust check for owner field (handles if it's an object or string)
  const raw = (json.data?.tickets ?? []) as any[];
  return raw.map(t => ({
    owner: typeof t.owner === 'object' ? t.owner.id : t.owner
  }));
}
