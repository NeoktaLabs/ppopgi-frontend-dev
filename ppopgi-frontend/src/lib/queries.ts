// Home — Big prizes
export const QUERY_BIG_PRIZES = `
  query BigPrizes($first: Int!) {
    raffles(
      first: $first
      where: { status: OPEN, paused: false }
      orderBy: winningPot
      orderDirection: desc
    ) {
      id
      name
      status
      paused
      ticketPrice
      deadline
      sold
      winningPot
      maxTickets
    }
  }
`;

// Home — Ending soon
export const QUERY_ENDING_SOON = `
  query EndingSoon($first: Int!, $now: BigInt!) {
    raffles(
      first: $first
      where: { status: OPEN, paused: false, deadline_gt: $now }
      orderBy: deadline
      orderDirection: asc
    ) {
      id
      name
      status
      paused
      ticketPrice
      deadline
      sold
      winningPot
      maxTickets
    }
  }
`;

// Raffle detail
export const QUERY_RAFFLE_DETAIL = `
  query RaffleDetail($id: Bytes!) {
    raffle(id: $id) {
      id
      name
      creator
      status
      paused
      ticketPrice
      winningPot
      deadline
      sold
      winner
      winningTicketIndex
      completedAt
      canceledReason
      canceledAt
    }
  }
`;