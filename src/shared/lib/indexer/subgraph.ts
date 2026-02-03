// src/indexer/subgraph.ts

export type RaffleStatus =
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED";

/**
 * Home list item.
 * - Mirrors your schema.graphql (V2) field nullability.
 * - Uses string for BigInt fields because The Graph returns BigInt as string.
 * - Uses `string | null` for nullable Graph fields.
 */
export type RaffleListItem = {
  id: string; // raffle address (Bytes as hex string)
  name: string;
  status: RaffleStatus;

  // canonical discovery
  deployer: string | null;
  registry: string | null;
  typeId: string | null; // BigInt
  registryIndex: string | null; // BigInt
  isRegistered: boolean;
  registeredAt: string | null; // BigInt (timestamp-ish)

  // creation metadata
  creator: string;
  createdAtBlock: string; // BigInt
  createdAtTimestamp: string; // BigInt
  creationTx: string; // Bytes

  // config / contracts
  usdc: string;
  entropy: string;
  entropyProvider: string;
  feeRecipient: string;
  protocolFeePercent: string; // BigInt
  callbackGasLimit: string; // BigInt
  minPurchaseAmount: string; // BigInt

  // economics
  winningPot: string; // BigInt
  ticketPrice: string; // BigInt
  deadline: string; // BigInt (seconds)
  minTickets: string; // BigInt
  maxTickets: string; // BigInt

  // lifecycle / state
  sold: string; // BigInt
  ticketRevenue: string; // BigInt
  paused: boolean;

  finalizeRequestId: string | null; // BigInt
  finalizedAt: string | null; // BigInt
  selectedProvider: string | null; // Bytes (address)

  winner: string | null;
  winningTicketIndex: string | null; // BigInt
  completedAt: string | null; // BigInt

  canceledReason: string | null;
  canceledAt: string | null; // BigInt
  soldAtCancel: string | null; // BigInt

  // indexing metadata
  lastUpdatedBlock: string; // BigInt
  lastUpdatedTimestamp: string; // BigInt
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
 * Fetch latest raffles ordered by lastUpdatedTimestamp descending.
 *
 * NOTE: This query intentionally includes "extra" fields so you don't have to
 * revisit it later when adding UI detail.
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

        # canonical discovery
        deployer
        registry
        typeId
        registryIndex
        isRegistered
        registeredAt

        # immutable creation metadata
        creator
        createdAtBlock
        createdAtTimestamp
        creationTx

        # config / contracts
        usdc
        entropy
        entropyProvider
        feeRecipient
        protocolFeePercent
        callbackGasLimit
        minPurchaseAmount

        # economics
        winningPot
        ticketPrice
        deadline
        minTickets
        maxTickets

        # lifecycle / state
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

        # indexing metadata
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
  if (json?.errors?.length) {
    throw new Error("SUBGRAPH_GQL_ERROR");
  }

  const raffles = (json.data?.raffles ?? []) as RaffleListItem[];

  // ✅ normalize ids for stable comparisons + map keys across the app
  return raffles.map((r) => ({
    ...r,
    id: String(r.id).toLowerCase(),
  }));
}