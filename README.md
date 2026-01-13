# Ppopgi (뽑기) — Frontend

This repository contains the frontend application for **Ppopgi**, a friendly and transparent raffle platform on **Etherlink (Tezos L2)**.

The UI is designed to feel safe and approachable while mapping **1:1 to on-chain data**.  
No simulated values, no fake activity, and no off-chain state.

## Features
- Explore and join on-chain raffles
- Create new raffles through the official factory
- Real-time raffle status, countdowns, and outcomes
- Pull-based prize and refund collection
- Clear visibility into fees, prizes, and raffle rules

## Design Philosophy
- Non-technical language for users
- Calm, playful UX inspired by Korean festival aesthetics
- Transparency without overwhelming blockchain jargon
- Safety over convenience at all times

## Technology
- React + Vite
- viem / wagmi
- Cloudflare Pages
- Etherlink Mainnet (Chain ID 42793)

## Important Notice
This frontend is **non-custodial** and interacts directly with smart contracts.  
All logic and outcomes are enforced on-chain.

The application is experimental and provided as-is.