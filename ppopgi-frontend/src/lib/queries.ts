// src/lib/queries.ts
import { gql } from "graphql-request";

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

      # verification (from subgraph)
      deployer
      isRegistered
      registry
    }
  }
`;

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

      # verification (from subgraph)
      deployer
      isRegistered
      registry
    }
  }
`;

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

export const QUERY_RAFFLE_EVENTS = `
  query RaffleEvents($raffle: Bytes!, $first: Int!) {
    raffleEvents(
      where: { raffle: $raffle }
      orderBy: blockTimestamp
      orderDirection: desc
      first: $first
    ) {
      type
      blockTimestamp
      actor
      target
      amount
      amount2
      text
      txHash
    }
  }
`;

export const QUERY_MY_CREATED_RAFFLES = `
  query MyCreatedRaffles($me: Bytes!, $first: Int!) {
    raffles(
      where: { creator: $me }
      orderBy: createdAtTimestamp
      orderDirection: desc
      first: $first
    ) {
      id
      name
      status
      paused
      ticketPrice
      winningPot
      deadline
      sold
      minTickets
      maxTickets
      createdAtTimestamp
      creationTx
      winner
      winningTicketIndex
      canceledAt
      canceledReason

      # verification (from subgraph)
      deployer
      isRegistered
      registry
    }
  }
`;

export const QUERY_MY_ACTIVITY_EVENTS = `
  query MyActivityEvents($me: Bytes!, $first: Int!) {
    raffleEvents(
      where: {
        actor: $me
        type_in: [
          TICKETS_PURCHASED
          FUNDS_CLAIMED
          NATIVE_CLAIMED
          REFUND_ALLOCATED
          NATIVE_REFUND_ALLOCATED
          PRIZE_ALLOCATED
        ]
      }
      orderBy: blockTimestamp
      orderDirection: desc
      first: $first
    ) {
      type
      blockTimestamp
      txHash
      amount
      amount2
      raffle {
        id
        name
        status
        paused
        ticketPrice
        winningPot
        deadline
        sold
        winner
        winningTicketIndex
        canceledAt
        canceledReason

        # verification (from subgraph)
        deployer
        isRegistered
        registry
      }
    }
  }
`;

export const QUERY_EXPLORE_RAFFLES = gql`
  query ExploreRaffles(
    $first: Int!
    $skip: Int!
    $where: Raffle_filter
    $orderBy: Raffle_orderBy!
    $orderDirection: OrderDirection!
  ) {
    raffles(
      first: $first
      skip: $skip
      where: $where
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      name
      status
      paused
      ticketPrice
      winningPot
      sold
      deadline
      maxTickets

      deployer
      isRegistered
      registry
    }
  }
`;