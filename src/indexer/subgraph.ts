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
  createdAtTimestamp: string;
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

// ✅ NEW: participant aggregation type (matches schema.graphql)
export type RaffleParticipantItem = {
  id: string;
  buyer: string;
  ticketsPurchased: string;
  firstSeenBlock: string;
  firstSeenTimestamp: string;
  lastSeenBlock: string;
  lastSeenTimestamp: string;
  lastRangeIndex: string | null;
  lastTotalSold: string | null;
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
 * ✅ NEW: FETCH PARTICIPANTS for a raffle (leaderboard)
 *
 * This uses the RaffleParticipant entity you added to the schema + mappings.
 * Note: buyer is Bytes on-chain, but GraphQL returns it as a hex string.
 */
export async function fetchRaffleParticipants(
  raffleId: string,
  opts: { first?: number; skip?: number; signal?: AbortSignal } = {}
): Promise<RaffleParticipantItem[]> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const first = Math.min(Math.max(opts.first ?? 1000, 1), 1000);
  const skip = Math.max(opts.skip ?? 0, 0);

  const query = `
    query GetParticipants($raffleId: Bytes!, $first: Int!, $skip: Int!) {
      raffle(id: $raffleId) {
        participants(
          first: $first
          skip: $skip
          orderBy: ticketsPurchased
          orderDirection: desc
        ) {
          id
          buyer
          ticketsPurchased
          firstSeenBlock
          firstSeenTimestamp
          lastSeenBlock
          lastSeenTimestamp
          lastRangeIndex
          lastTotalSold
        }
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { raffleId: raffleId.toLowerCase(), first, skip },
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      console.error("Subgraph participants fetch failed", res.status);
      return [];
    }

    const json = await res.json();
    if (json?.errors?.length) {
      console.error("Subgraph participants GQL error", json.errors);
      return [];
    }

    const raw = (json.data?.raffle?.participants ?? []) as any[];

    return raw.map((p) => ({
      id: String(p.id).toLowerCase(),
      buyer: String(p.buyer).toLowerCase(),
      ticketsPurchased: String(p.ticketsPurchased),
      firstSeenBlock: String(p.firstSeenBlock),
      firstSeenTimestamp: String(p.firstSeenTimestamp),
      lastSeenBlock: String(p.lastSeenBlock),
      lastSeenTimestamp: String(p.lastSeenTimestamp),
      lastRangeIndex: p.lastRangeIndex != null ? String(p.lastRangeIndex) : null,
      lastTotalSold: p.lastTotalSold != null ? String(p.lastTotalSold) : null,
    }));
  } catch (e) {
    console.error("Error fetching participants:", e);
    return [];
  }
}

/**
 * ✅ OPTIONAL: Fetch raffle + participants in one call (useful for the details modal)
 */
export async function fetchRaffleWithParticipants(
  raffleId: string,
  opts: { firstParticipants?: number; signal?: AbortSignal } = {}
): Promise<{ raffle: Partial<RaffleListItem> | null; participants: RaffleParticipantItem[] }> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const firstParticipants = Math.min(Math.max(opts.firstParticipants ?? 200, 1), 1000);

  const query = `
    query RaffleWithParticipants($id: Bytes!, $firstParticipants: Int!) {
      raffle(id: $id) {
        id
        name
        status
        createdAtTimestamp
        deadline
        sold
        ticketPrice
        ticketRevenue
        participants(first: $firstParticipants, orderBy: ticketsPurchased, orderDirection: desc) {
          id
          buyer
          ticketsPurchased
          firstSeenTimestamp
          lastSeenTimestamp
        }
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { id: raffleId.toLowerCase(), firstParticipants },
      }),
      signal: opts.signal,
    });

    if (!res.ok) return { raffle: null, participants: [] };

    const json = await res.json();
    if (json?.errors?.length) {
      console.error("Subgraph raffle+participants GQL error", json.errors);
      return { raffle: null, participants: [] };
    }

    const r = json.data?.raffle ?? null;
    const participants = (r?.participants ?? []) as any[];

    return {
      raffle: r
        ? {
            ...r,
            id: String(r.id).toLowerCase(),
          }
        : null,
      participants: participants.map((p) => ({
        id: String(p.id).toLowerCase(),
        buyer: String(p.buyer).toLowerCase(),
        ticketsPurchased: String(p.ticketsPurchased),
        firstSeenBlock: "0",
        firstSeenTimestamp: String(p.firstSeenTimestamp ?? "0"),
        lastSeenBlock: "0",
        lastSeenTimestamp: String(p.lastSeenTimestamp ?? "0"),
        lastRangeIndex: null,
        lastTotalSold: null,
      })),
    };
  } catch (e) {
    console.error("fetchRaffleWithParticipants failed:", e);
    return { raffle: null, participants: [] };
  }
}

/**
 * ✅ Keep this (already useful)
 */
export async function fetchRaffleMetadata(
  raffleId: string
): Promise<Partial<RaffleListItem> | null> {
  const url = mustEnv("VITE_SUBGRAPH_URL");

  const query = `
    query GetMetadata($id: Bytes!) {
      raffle(id: $id) {
        createdAtTimestamp
        deadline
        entropyProvider
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { id: raffleId.toLowerCase() } }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.raffle || null;
  } catch (e) {
    console.error("Metadata fetch failed:", e);
    return null;
  }
}

/**
 * ❌ OLD (Ticket entity) — remove if your subgraph does not have `Ticket`.
 * If you keep this, it will throw GQL errors unless Ticket exists in schema.
 */
// export type TicketItem = { owner: string };
// export async function fetchRaffleTickets(raffleId: string): Promise<TicketItem[]> { ... }