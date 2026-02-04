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

// participants aggregation type (matches schema.graphql)
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

// ✅ UPDATED: Global activity stream (Sales + Creations + Winners + Cancels)
export type GlobalActivityItem = {
  type: "BUY" | "CREATE" | "WIN" | "CANCEL";
  raffleId: string;
  raffleName: string;
  subject: string; // Buyer, Creator, or Winner
  value: string;   // Ticket Count or Prize Pot
  timestamp: string;
  txHash: string;
};

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

/** Normalize hex strings (addresses/tx hashes/bytes IDs) for safe comparisons in UI */
function normHex(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return String(v).toLowerCase();
  return v.toLowerCase();
}

type FetchRafflesOptions = {
  first?: number;
  skip?: number;
  signal?: AbortSignal;
};

async function gqlFetch<T>(
  url: string,
  query: string,
  variables: Record<string, any>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("Subgraph HTTP error", res.status, json);
    throw new Error(`SUBGRAPH_HTTP_ERROR_${res.status}`);
  }

  if (json?.errors?.length) {
    console.error("Subgraph GQL error", json.errors);
    throw new Error("SUBGRAPH_GQL_ERROR");
  }

  return json.data as T;
}

// ✅ Reusable Fragment to ensure consistency between lists and details
const RAFFLE_FIELDS = `
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
`;

export async function fetchRafflesFromSubgraph(
  opts: FetchRafflesOptions = {}
): Promise<RaffleListItem[]> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const first = Math.min(Math.max(opts.first ?? 500, 1), 1000);
  const skip = Math.max(opts.skip ?? 0, 0);

  const query = `
    query HomeRaffles($first: Int!, $skip: Int!) {
      raffles(
        first: $first
        skip: $skip
        orderBy: lastUpdatedTimestamp
        orderDirection: desc
      ) {
        ${RAFFLE_FIELDS}
      }
    }
  `;

  type Resp = { raffles: RaffleListItem[] };
  const data = await gqlFetch<Resp>(url, query, { first, skip }, opts.signal);

  return (data.raffles ?? []).map((r) => normalizeRaffle(r));
}

/**
 * ✅ FETCH PARTICIPANTS for a raffle (leaderboard)
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
      raffleParticipants(
        first: $first
        skip: $skip
        where: { raffle: $raffleId }
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
  `;

  type Resp = { raffleParticipants: any[] };
  const data = await gqlFetch<Resp>(
    url,
    query,
    { raffleId: raffleId.toLowerCase(), first, skip },
    opts.signal
  );

  const raw = (data.raffleParticipants ?? []) as any[];
  return raw.map(normalizeParticipant);
}

/**
 * ✅ FETCH RAFFLE + PARTICIPANTS (Detail View)
 */
export async function fetchRaffleWithParticipants(
  raffleId: string,
  opts: { firstParticipants?: number; participantsSkip?: number; signal?: AbortSignal } = {}
): Promise<{ raffle: RaffleListItem | null; participants: RaffleParticipantItem[] }> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const firstParticipants = Math.min(Math.max(opts.firstParticipants ?? 200, 1), 1000);
  const participantsSkip = Math.max(opts.participantsSkip ?? 0, 0);

  const query = `
    query RaffleWithParticipants($id: Bytes!, $firstParticipants: Int!, $participantsSkip: Int!) {
      raffle(id: $id) {
        ${RAFFLE_FIELDS}
      }
      raffleParticipants(
        first: $firstParticipants
        skip: $participantsSkip
        where: { raffle: $id }
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
  `;

  type Resp = { raffle: any | null; raffleParticipants: any[] };
  const data = await gqlFetch<Resp>(
    url,
    query,
    { id: raffleId.toLowerCase(), firstParticipants, participantsSkip },
    opts.signal
  );

  const r = data.raffle ?? null;
  const participants = (data.raffleParticipants ?? []) as any[];

  return {
    raffle: r ? normalizeRaffle(r) : null,
    participants: participants.map(normalizeParticipant),
  };
}

/**
 * ✅ FETCH GLOBAL ACTIVITY (Sales + Creations + Winners + Cancels)
 */
export async function fetchGlobalActivity(
  opts: { first?: number; signal?: AbortSignal } = {}
): Promise<GlobalActivityItem[]> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const first = Math.min(Math.max(opts.first ?? 15, 1), 50);

  const query = `
    query GlobalFeed($first: Int!) {
      # 1. Ticket Sales
      raffleEvents(
        first: $first
        orderBy: blockTimestamp
        orderDirection: desc
        where: { type: TICKETS_PURCHASED }
      ) {
        raffle { id name }
        actor
        uintValue
        blockTimestamp
        txHash
      }
      
      # 2. New Raffles
      raffles(
        first: $first
        orderBy: createdAtTimestamp
        orderDirection: desc
      ) {
        id
        name
        creator
        winningPot
        createdAtTimestamp
        creationTx
      }

      # 3. Recent Winners
      recentWinners: raffles(
        first: $first
        orderBy: completedAt
        orderDirection: desc
        where: { status: COMPLETED }
      ) {
        id
        name
        winner
        winningPot
        completedAt
      }

      # 4. Recent Cancels
      recentCancels: raffles(
        first: $first
        orderBy: canceledAt
        orderDirection: desc
        where: { status: CANCELED }
      ) {
        id
        name
        creator
        canceledAt
      }
    }
  `;

  type Resp = { raffleEvents: any[]; raffles: any[]; recentWinners: any[]; recentCancels: any[] };
  const data = await gqlFetch<Resp>(url, query, { first }, opts.signal);

  // 1. Process Sales
  const sales = (data.raffleEvents ?? []).map((e) => ({
    type: "BUY" as const,
    raffleId: normHex(e.raffle?.id) as string,
    raffleName: String(e.raffle?.name ?? "Unknown Raffle"),
    subject: normHex(e.actor) as string,
    value: String(e.uintValue),
    timestamp: String(e.blockTimestamp),
    txHash: normHex(e.txHash) as string,
  }));

  // 2. Process Creations
  const creations = (data.raffles ?? []).map((r) => ({
    type: "CREATE" as const,
    raffleId: normHex(r.id) as string,
    raffleName: String(r.name || "Untitled Raffle"),
    subject: normHex(r.creator) as string,
    value: String(r.winningPot),
    timestamp: String(r.createdAtTimestamp),
    txHash: normHex(r.creationTx) as string,
  }));

  // 3. Process Winners
  const winners = (data.recentWinners ?? []).map((r) => ({
    type: "WIN" as const,
    raffleId: normHex(r.id) as string,
    raffleName: String(r.name || "Untitled Raffle"),
    subject: normHex(r.winner) as string,
    value: String(r.winningPot),
    timestamp: String(r.completedAt),
    txHash: normHex(r.id) as string,
  }));

  // 4. Process Cancels
  const cancels = (data.recentCancels ?? []).map((r) => ({
    type: "CANCEL" as const,
    raffleId: normHex(r.id) as string,
    raffleName: String(r.name || "Untitled Raffle"),
    subject: normHex(r.creator) as string,
    value: "0",
    timestamp: String(r.canceledAt),
    txHash: normHex(r.id) as string,
  }));

  // Merge & Sort Chronologically (Newest first)
  const combined = [...sales, ...creations, ...winners, ...cancels].sort((a, b) => 
    Number(b.timestamp) - Number(a.timestamp)
  );

  return combined.slice(0, first);
}

// --- Helpers ---

function normalizeRaffle(r: any): RaffleListItem {
  return {
    ...r,
    id: normHex(r.id) as string,
    deployer: normHex(r.deployer),
    registry: normHex(r.registry),
    creator: normHex(r.creator) as string,
    creationTx: normHex(r.creationTx) as string,
    usdc: normHex(r.usdc) as string,
    entropy: normHex(r.entropy) as string,
    entropyProvider: normHex(r.entropyProvider) as string,
    feeRecipient: normHex(r.feeRecipient) as string,
    selectedProvider: normHex(r.selectedProvider),
    winner: normHex(r.winner),
  };
}

function normalizeParticipant(p: any): RaffleParticipantItem {
  return {
    id: normHex(p.id) as string,
    buyer: normHex(p.buyer) as string,
    ticketsPurchased: String(p.ticketsPurchased),
    firstSeenBlock: String(p.firstSeenBlock),
    firstSeenTimestamp: String(p.firstSeenTimestamp),
    lastSeenBlock: String(p.lastSeenBlock),
    lastSeenTimestamp: String(p.lastSeenTimestamp),
    lastRangeIndex: p.lastRangeIndex != null ? String(p.lastRangeIndex) : null,
    lastTotalSold: p.lastTotalSold != null ? String(p.lastTotalSold) : null,
  };
}

export async function fetchRaffleMetadata(
  raffleId: string,
  opts: { signal?: AbortSignal } = {}
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
    type Resp = { raffle: any | null };
    const data = await gqlFetch<Resp>(
      url,
      query,
      { id: raffleId.toLowerCase() },
      opts.signal
    );

    const r = data.raffle ?? null;
    if (!r) return null;

    return {
      ...r,
      entropyProvider: normHex(r.entropyProvider) as string,
    };
  } catch (e) {
    console.error("Metadata fetch failed:", e);
    return null;
  }
}

export async function fetchMyJoinedRaffleIds(
  buyer: string,
  opts: { first?: number; skip?: number; signal?: AbortSignal } = {}
): Promise<string[]> {
  const url = mustEnv("VITE_SUBGRAPH_URL");
  const first = Math.min(Math.max(opts.first ?? 1000, 1), 1000);
  const skip = Math.max(opts.skip ?? 0, 0);

  const query = `
    query MyJoined($buyer: Bytes!, $first: Int!, $skip: Int!) {
      raffleParticipants(
        first: $first
        skip: $skip
        where: { buyer: $buyer }
      ) {
        raffle { id }
      }
    }
  `;

  try {
    type Resp = { raffleParticipants: any[] };
    const data = await gqlFetch<Resp>(
      url,
      query,
      { buyer: buyer.toLowerCase(), first, skip },
      opts.signal
    );

    const rows = (data.raffleParticipants ?? []) as any[];

    return rows
      .map((x) => normHex(x?.raffle?.id) ?? "")
      .filter(Boolean) as string[];
  } catch (e) {
    console.error("fetchMyJoinedRaffleIds failed:", e);
    return [];
  }
}
