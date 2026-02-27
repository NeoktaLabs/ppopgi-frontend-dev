# Etherlink Lottery Frontend

Frontend for an on-chain USDC lottery app on Etherlink (Tezos L2, EVM).  
Users can browse lotteries, buy tickets, view participants, and follow an on-chain timeline of each lottery.

## Features

- Wallet connect + transactions (buy tickets / approvals)
- Lottery list + details modal (receipt-style UI)
- Live activity feed (buys / creates / wins / cancels)
- Holders list + participant stats
- Range policy UI (explains ticket range behavior)
- Subgraph-powered fast reads + on-chain reads for critical values

## Tech Stack

- React + Vite
- TypeScript
- thirdweb (wallet + contract interactions)
- The Graph (Subgraph indexing)
- Etherlink (EVM L2)
- USDC (ticket currency)

## Project Structure

- `src/components/` UI components (LotteryCard, LotteryDetailsModal, ActivityBoard, etc.)
- `src/hooks/` app hooks (contract reads/writes, activity store, participants, etc.)
- `src/indexer/` subgraph queries / typed entities
- `src/lib/` shared utilities (formatters, helpers)

## Data Sources

The frontend reads from two sources:

1. On-chain reads (RPC)
   - balances / allowance
   - ticket pricing
   - lottery config and state

2. Subgraph (GraphQL)
   - lottery lists and history
   - participants / ranges data
   - activity feed events
   - timeline reconstruction (fast UX)

## Setup

### Install

```bash
npm install